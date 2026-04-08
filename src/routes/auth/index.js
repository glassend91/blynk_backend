const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const OTP = require('../../models/OTP');
const PackageSelection = require('../../models/PackageSelection');
const Role = require('../../models/Role');
const { sendOTPEmail, sendWelcomeEmail, sendAdminInviteEmail } = require('../../utils/emailService');
const Service = require('../../models/Service');
const ServiceSubscription = require('../../models/ServiceSubscription');
const WholesalerPlan = require('../../models/WholesalerPlan');
const otpProviderService = require('../../services/otpProviderService');
const wholesalerService = require('../../services/wholesalerService');

const router = express.Router();

// Shared auth middleware for protected admin endpoints
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { default: mongoose } = require('mongoose');

const JWT_EXPIRES_IN = '7d';
const OTP_EXPIRY_MINUTES = 10;
const ADMIN_INVITE_URL = process.env.ADMIN_INVITE_URL || 'https://app.blynk.com/login';
// Admin UI role labels (backed by Roles collection in admin app)
const ADMIN_ROLE_LABELS = ['Admin', 'Content Manager', 'Support Agent', 'Technician Manager'];
// Map UI role label -> internal DB role code
const UI_ROLE_TO_DB_ROLE = {
    'Admin': 'admin',
    'Content Manager': 'admin',
    'Support Agent': 'admin',
    'Technician Manager': 'admin',
};
const DB_ROLE_TO_UI_ROLE = {
    admin: 'admin',
    support: 'Technical Support',
    customer: 'Customer',
    contentEditor: 'Content Editor',
    technicalSupport: 'Technical Support',
    supportManager: 'Support Manager',
    administrator: 'Administrator',
};

function createToken(userId) {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    return jwt.sign({ sub: userId }, secret, { expiresIn: JWT_EXPIRES_IN });
}

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function mapUiRoleToDb(roleLabel) {
    return UI_ROLE_TO_DB_ROLE[roleLabel] || 'support';
}

function getDisplayRole(user) {
    // Prefer subrole (new field) over adminRoleLabel (legacy)
    if (user.subrole) {
        return user.subrole;
    }
    if (user.adminRoleLabel && ADMIN_ROLE_LABELS.includes(user.adminRoleLabel)) {
        return user.adminRoleLabel;
    }
    return DB_ROLE_TO_UI_ROLE[user.role] || 'Support Manager';
}

function formatUserForAdminList(user, order = 0) {
    return {
        id: order,
        userId: user._id.toString(),
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        email: user.email,
        type: user.type,
        phone: user.phone,
        customerType: user.customerType,
        role: getDisplayRole(user),
        status: user.status || 'Active',
        lastLogin: 'Never',
        created: user.createdAt ? user.createdAt.toISOString().slice(0, 10) : '',
    };
}

router.post(
    '/signup',
    [
        body('firstName').isString().trim().notEmpty(),
        body('lastName').isString().trim().notEmpty(),
        body('email').isEmail(),
        // body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('phone').optional().isString().trim(),
        body('serviceAddress').optional().isString().trim(),
        body('type').optional().isIn(['NBN', 'MBL', 'MBB', 'SME']),
        // MBL optional fields
        body('mblSelectedNumber').optional().isString().trim(),
        body('mblKeepExistingNumber').optional().isBoolean(),
        body('mblCurrentMobileNumber').optional().isString().trim(),
        body('mblCurrentProvider').optional().isString().trim(),
        body('dateOfBirth').optional().isString().trim(),
        body('billingAddress').optional().isString().trim(),
        body('identity').optional().custom((value) => {
            if (value === null || value === undefined) return true;
            return typeof value === 'object' && !Array.isArray(value);
        }).withMessage('Identity must be an object or null'),
        body('businessDetails').optional().custom((value) => {
            if (value === null || value === undefined) return true;
            return typeof value === 'object' && !Array.isArray(value);
        }).withMessage('Business details must be an object or null'),
        body('simType').optional().isIn(['eSim', 'physical']),
        body('simNumber').optional().isString().trim(), // ICCID for physical SIM
        body('esimNotificationEmail').optional().isEmail().withMessage('Valid email is required for eSIM notification'), // Email for eSIM notifications
        body('selectedPlan').optional().isObject().withMessage('Selected plan must be an object'),
        body('customerType').optional().isIn(['residential', 'business']).withMessage('Customer type must be residential or business'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                firstName,
                lastName,
                email,
                password,
                phone,
                serviceAddress,
                type,
                mblSelectedNumber,
                mblKeepExistingNumber,
                mblCurrentMobileNumber,
                mblCurrentProvider,
                dateOfBirth,
                billingAddress,
                identity,
                businessDetails,
                simType,
                simNumber,
                esimNotificationEmail,
                selectedPlan,
                customerType,
                locId, // Added NBN locId parameter
                ntdId, // Added NBN line/NTD ID parameter
                port, // Added NBN port parameter
                serviceRef, // Added NBN service_ref parameter
                wantsStaticIp, // Added NBN static_ip flag
            } = req.body;

            console.log('body', req.body);

            // Validate business details: require either ABN or ACN
            if (businessDetails) {
                const hasABN = businessDetails.ABN && businessDetails.ABN.trim().length > 0;
                const hasACN = businessDetails.ACN && businessDetails.ACN.trim().length > 0;

                if (!hasABN && !hasACN) {
                    return res.status(400).json({
                        success: false,
                        message: 'Either ABN or ACN is required for business signups',
                        errors: [{
                            path: 'businessDetails.ABN',
                            msg: 'Either ABN or ACN must be provided'
                        }]
                    });
                }
            }

            // Check if email is already registered (only block fully registered users)
            const existing = await User.findOne({ email });
            if (existing) {
                return res.status(409).json({
                    message: 'This email address is already in use. Please log in to your account or contact customer service for assistance.'
                });
            }

            // Validate conditional SIM fields based on simType
            // For mobile services (MBL, MBB), validate SIM provisioning fields
            if ((type === 'MBL' || type === 'MBB') && simType) {
                if (simType === 'physical') {
                    // Physical SIM: simNumber (ICCID) is mandatory
                    if (!simNumber || !simNumber.trim()) {
                        return res.status(400).json({
                            success: false,
                            message: 'SIM Card Number (ICCID) is required for physical SIM',
                            errors: [{
                                path: 'simNumber',
                                msg: 'SIM Card Number (ICCID) is mandatory for physical SIM'
                            }]
                        });
                    }
                } else if (simType === 'eSim') {
                    // eSIM: esimNotificationEmail is mandatory
                    if (!esimNotificationEmail || !esimNotificationEmail.trim()) {
                        return res.status(400).json({
                            success: false,
                            message: 'eSIM Notification Email is required for eSIM',
                            errors: [{
                                path: 'esimNotificationEmail',
                                msg: 'eSIM Notification Email is mandatory for eSIM'
                            }]
                        });
                    }
                    // Validate email format
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(esimNotificationEmail)) {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid eSIM notification email format',
                            errors: [{
                                path: 'esimNotificationEmail',
                                msg: 'Please provide a valid email address'
                            }]
                        });
                    }
                }
            }

            const passwordHash = await bcrypt.hash(password, 10);

            // Determine customerType if not provided
            // If businessDetails is provided, it's a business customer
            // Otherwise, default to residential
            let finalCustomerType = customerType;
            if (!finalCustomerType) {
                finalCustomerType = businessDetails ? 'business' : 'residential';
            }

            const user = await User.create({
                firstName,
                lastName,
                email,
                phone,
                serviceAddress,
                type,
                mblSelectedNumber,
                mblKeepExistingNumber,
                mblCurrentMobileNumber,
                mblCurrentProvider,
                dateOfBirth,
                billingAddress,
                identity,
                businessDetails,
                simType,
                simNumber: simType === 'physical' ? simNumber : undefined, // Only store if physical SIM
                esimNotificationEmail: simType === 'eSim' ? (esimNotificationEmail || email).toLowerCase() : undefined, // Default to account email if not provided
                passwordHash,
                customerType: finalCustomerType,
                otpVerified: false,
                status: 'Pending'
            });

            const token = createToken(user.id);

            // Create a service subscription for the new user so plans appear in customer portal
            (async () => {
                try {
                    let serviceToSubscribe = null;
                    let wholesalerPlanToSubscribe = null;

                    // Prefer explicit selectedPlan id from request
                    if (selectedPlan && (selectedPlan.id || selectedPlan._id)) {
                        const planIdOrValue = selectedPlan.id || selectedPlan._id;

                        // If MBL or MBB, lookup WholesalerPlan instead of Service
                        if (type === 'MBL' || type === 'MBB') {
                            try {
                                const WholesalerPlan = require('../../models/WholesalerPlan');
                                wholesalerPlanToSubscribe = await WholesalerPlan.findOne({
                                    $or: [
                                        { value: isNaN(planIdOrValue) ? null : Number(planIdOrValue) },
                                        mongoose.isValidObjectId(planIdOrValue) ? { _id: planIdOrValue } : null
                                    ].filter(Boolean)
                                });
                            } catch (e) {
                                console.error('Error finding WholesalerPlan:', e);
                            }
                        } else {
                            try {
                                serviceToSubscribe = await Service.findById(planIdOrValue);
                            } catch (e) {
                                // ignore and fallback to default
                            }
                        }
                    }

                    // Fallback: find a default service by signup type
                    if (!serviceToSubscribe && !wholesalerPlanToSubscribe) {
                        const TYPE_TO_SERVICE_TYPE = {
                            NBN: 'NBN',
                            MBL: 'Mobile',
                            MBB: 'Data Only',
                            SME: 'Business NBN'
                        };
                        const serviceTypeForQuery = TYPE_TO_SERVICE_TYPE[type];
                        if (serviceTypeForQuery) {
                            try {
                                serviceToSubscribe = await Service.findOne({ serviceType: serviceTypeForQuery, isAvailable: true, isActive: true }).sort({ price: 1 });
                            } catch (svcErr) {
                                console.error('Error fetching default service for subscription creation:', svcErr);
                            }
                        }
                    }

                    if (serviceToSubscribe || wholesalerPlanToSubscribe) {
                        const subscriptionPrice = serviceToSubscribe ? serviceToSubscribe.price : (wholesalerPlanToSubscribe ? wholesalerPlanToSubscribe.price : ((selectedPlan && selectedPlan.price) || 0));
                        await ServiceSubscription.create({
                            serviceId: serviceToSubscribe ? serviceToSubscribe._id : undefined,
                            wholesalerPlanId: wholesalerPlanToSubscribe ? wholesalerPlanToSubscribe._id : undefined,
                            userId: user._id,
                            subscriptionStatus: 'active',
                            subscribedAt: new Date(),
                            activatedAt: new Date(),
                            subscriptionPrice,
                            currency: serviceToSubscribe ? (serviceToSubscribe.currency || 'AUD') : 'AUD',
                            billingCycle: serviceToSubscribe ? (serviceToSubscribe.billingCycle || 'monthly') : 'monthly'
                        });
                    }
                } catch (subErr) {
                    console.error('Failed to create initial service subscription:', subErr);
                }
            })();

            // Send order confirmation email for NBN, MBL, and MBB signups
            if (type === 'NBN' || type === 'MBL' || type === 'MBB') {
                try {
                    const { sendOrderConfirmationEmail } = require('../../utils/emailService');
                    // Use selected plan from request; otherwise query DB for a default service plan
                    let planName = 'Plan';
                    let amount = 0;

                    const TYPE_TO_SERVICE_TYPE = {
                        NBN: 'NBN',
                        MBL: 'Mobile',
                        MBB: 'Data Only',
                        SME: 'Business NBN'
                    };

                    if (selectedPlan && selectedPlan.name) {
                        planName = selectedPlan.name;
                        amount = selectedPlan.price || 0;
                    } else {
                        // Try to find a matching service in DB for the signup type
                        const serviceTypeForQuery = TYPE_TO_SERVICE_TYPE[type];
                        if (serviceTypeForQuery) {
                            try {
                                const svc = await Service.findOne({ serviceType: serviceTypeForQuery, isAvailable: true, isActive: true }).sort({ price: 1 }).lean();
                                if (svc) {
                                    planName = svc.serviceName || serviceTypeForQuery;
                                    amount = svc.price || 0;
                                }
                            } catch (svcErr) {
                                console.error('Error fetching default service plan for signup:', svcErr);
                            }
                        }

                        // Final fallback to previous static defaults if DB lookup failed
                        if (!planName || planName === 'Plan') {
                            if (type === 'NBN') {
                                planName = 'NBN Plan';
                                amount = 69.99;
                            } else if (type === 'MBL') {
                                planName = 'Mobile Voice Plan';
                                amount = 35.00;
                            } else if (type === 'MBB') {
                                planName = 'Mobile Broadband Plan';
                                amount = 35.00;
                            }
                        }
                    }

                    await sendOrderConfirmationEmail(
                        email,
                        `${firstName} ${lastName}`,
                        planName,
                        amount,
                        user.id.toString()
                    );
                } catch (emailError) {
                    console.error('Error sending order confirmation email:', emailError);
                    // Don't fail the signup if email fails
                }
            }

            // 6. Wholesaler Orchestration (Step 2 & 3)
            // We make this blocking and atomic to ensure consistency
            try {
                if (user && user._id) {
                    console.log(`[SIGNUP] Integrating with Wholesaler for user ${user.email} (Type: ${type})`);

                    // A. Create Customer
                    const customerResult = await wholesalerService.createCustomer(user);
                    if (!customerResult.success) {
                        throw new Error(`Wholesaler Customer Creation Failed: ${customerResult.message}`);
                    }

                    user.wholesalerCustomerId = customerResult.customerId;
                    await user.save();
                    console.log(`[SIGNUP] Linked Wholesaler ID ${customerResult.customerId} to user ${user._id}`);

                    // B. Submit Final Order (Blocking for NBN, optional for MBL/MBB but making all blocking for reliability)
                    if ((type === 'MBL' || type === 'MBB')) {
                        let planNumber = 0;
                        let serviceLabel = `${user.firstName} ${user.lastName} - ${mblSelectedNumber}`;

                        if (selectedPlan) {
                            planNumber = selectedPlan.id || selectedPlan.value || 0;
                            if (selectedPlan.name) serviceLabel = selectedPlan.name;
                        }

                        const serviceDetails = {
                            esim: simType === 'eSim',
                            sim_number: simType === 'physical' ? simNumber : null,
                            plan_number: planNumber,
                            selected_number: mblSelectedNumber || phone,
                            service_label: serviceLabel,
                            esim_notification_email: esimNotificationEmail
                        };

                        const orderResult = await wholesalerService.submitOrder(user, user.wholesalerCustomerId, serviceDetails);
                        if (!orderResult.success) {
                            throw new Error(`MBL/MBB Order Submission Failed: ${orderResult.message || 'Unknown error'}`);
                        }
                    } else if (type === 'NBN' && locId && selectedPlan && selectedPlan.id) {
                        console.log(`[SIGNUP] Commencing NBN Order orchestration for ${user.email}...`);

                        // Switch context to customer
                        await wholesalerService.switchToTenant(user.wholesalerCustomerId);

                        try {
                            // 1. Create Site
                            const siteResult = await wholesalerService.createSite(user.wholesalerCustomerId, user);
                            if (!siteResult.success) throw new Error(`NBN Site Creation Failed: ${siteResult.message}`);

                            // 2. Create Contact
                            const contactResult = await wholesalerService.createContact(user.wholesalerCustomerId, user);
                            if (!contactResult.success) throw new Error(`NBN Contact Creation Failed: ${contactResult.message}`);

                            // 3. Submit NBN Order
                            let finalBandwidthId = selectedPlan.id;

                            // If it's a manual/wholesaler plan (MongoDB ID), resolve the final bandwidth_id
                            if (mongoose.isValidObjectId(selectedPlan.id)) {
                                // 1. Try WholesalerPlan first
                                const wPlan = await WholesalerPlan.findById(selectedPlan.id);
                                if (wPlan && wPlan.bandwidth_id) {
                                    finalBandwidthId = wPlan.bandwidth_id;
                                } else {
                                    // 2. Fallback to Service model
                                    const svc = await Service.findById(selectedPlan.id);
                                    if (svc && svc.wholesalerPlanId) {
                                        finalBandwidthId = svc.wholesalerPlanId;
                                    }
                                }
                            }

                            const nbnOrderPayload = {
                                loc_id: locId,
                                customer_id: user.wholesalerCustomerId,
                                site_id: siteResult.siteId,
                                contact_id: contactResult.contactId,
                                bandwidth_id: finalBandwidthId,
                                line: ntdId || "NEW",
                                port: port || "",
                                service_ref: serviceRef || "",
                                static_ip: !!wantsStaticIp
                            };

                            const orderResult = await wholesalerService.submitNbnOrder(nbnOrderPayload);
                            if (!orderResult.success) {
                                throw new Error(`NBN Order Submission Failed: ${orderResult.message}`);
                            }

                            console.log('[SIGNUP] NBN Order submitted successfully!');
                        } finally {
                            // Switch context back to master (always)
                            await wholesalerService.switchBack(user.wholesalerCustomerId);
                        }
                    }
                }
            } catch (wholesalerErr) {
                console.error('[SIGNUP] Wholesaler integration error:', wholesalerErr.message);

                // CLEANUP: Delete the local user if any wholesaler step fails
                if (user && user._id) {
                    console.warn(`[SIGNUP] Rolling back: Deleting local user ${user._id} due to wholesaler failure.`);
                    await User.findByIdAndDelete(user._id);
                }

                return res.status(400).json({
                    success: false,
                    message: wholesalerErr.message || 'Failed to complete wholesaler provisioning. Signup rolled back.'
                });
            }

            return res.status(201).json({
                token,
                user: user.toSafeJSON(),
                success: true,
                message: 'Account created successfully. Please request OTP to verify your email.'
            });
        } catch (err) {
            next(err);
        }
    }
);

// OTP endpoints - Independent of user creation
router.post(
    '/otp/send',
    [body('email').isEmail().withMessage('Valid email is required')],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email } = req.body;

            // Check if there's an existing unverified OTP for this email
            const existingOTP = await OTP.getActiveOTP(email);

            // Generate new OTP
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

            if (existingOTP) {
                // Update existing OTP
                existingOTP.otp = otp;
                existingOTP.otpExpiry = otpExpiry;
                existingOTP.attempts = 0; // Reset attempts
                existingOTP.verified = false;
                await existingOTP.save();
            } else {
                // Create new OTP record
                await OTP.create({
                    email: email?.toLowerCase() || '',
                    otp,
                    otpExpiry,
                    verified: false,
                    attempts: 0,
                    purpose: 'email_verification'
                });
            }

            // Send OTP via SMS (if user has phone)
            try {
                // Find user to get phone number if available
                const user = await User.findOne({ email: email.toLowerCase() });

                if (!user || !user.phone) {
                    return res.status(400).json({
                        success: false,
                        message: 'No mobile number associated with this account. SMS OTP cannot be sent.'
                    });
                }

                // Send SMS OTP via external provider
                const smsRes = await otpProviderService.sendSMSOTP(user.phone);

                if (smsRes.success) {
                    const transactionId = smsRes.data?.transactionId || smsRes.data?.data?.transactionId;
                    console.log(`[AUTH OTP] SMS sent successfully. Transaction ID: ${transactionId}`);

                    // Update OTP record with transactionId
                    const otpRecord = await OTP.findOne({ email: email.toLowerCase(), verified: false }).sort({ createdAt: -1 });
                    if (otpRecord) {
                        otpRecord.transactionId = transactionId;
                        await otpRecord.save();
                    }

                    return res.json({
                        success: true,
                        message: `OTP sent to ${user.phone} successfully`,
                        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
                    });
                } else {
                    console.error(`[AUTH OTP] SMS failed:`, smsRes.error || smsRes.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to send SMS OTP. Please try again.'
                    });
                }
            } catch (err) {
                console.error('Failed to send SMS OTP:', err);
                return res.status(500).json({
                    success: false,
                    message: 'An unexpected error occurred. Please try again.'
                });
            }
        } catch (err) {
            next(err);
        }
    }
);


// Resend OTP - Same as send OTP (uses OTP model)
router.post(
    '/otp/resend',
    [body('email').isEmail().withMessage('Valid email is required')],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email } = req.body;

            // Check if there's an existing unverified OTP for this email
            const existingOTP = await OTP.getActiveOTP(email);

            // Generate new OTP
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

            if (existingOTP) {
                // Update existing OTP
                existingOTP.otp = otp;
                existingOTP.otpExpiry = otpExpiry;
                existingOTP.attempts = 0; // Reset attempts
                existingOTP.verified = false;
                await existingOTP.save();
            } else {
                // Create new OTP record
                await OTP.create({
                    email: email?.toLowerCase() || '',
                    otp,
                    otpExpiry,
                    verified: false,
                    attempts: 0,
                    purpose: 'email_verification'
                });
            }

            // Send OTP via SMS (if user has phone)
            try {
                // Find user to get phone number if available
                const user = await User.findOne({ email: email.toLowerCase() });

                if (!user || !user.phone) {
                    return res.status(400).json({
                        success: false,
                        message: 'No mobile number associated with this account. SMS OTP cannot be sent.'
                    });
                }

                // Send SMS OTP via external provider
                const smsRes = await otpProviderService.sendSMSOTP(user.phone);

                if (smsRes.success) {
                    const transactionId = smsRes.data?.transactionId || smsRes.data?.data?.transactionId;
                    console.log(`[AUTH RESEND OTP] SMS sent successfully. Transaction ID: ${transactionId}`);

                    // Update OTP record with transactionId
                    const otpRecord = await OTP.findOne({ email: email.toLowerCase(), verified: false }).sort({ createdAt: -1 });
                    if (otpRecord) {
                        otpRecord.transactionId = transactionId;
                        await otpRecord.save();
                    }

                    return res.json({
                        success: true,
                        message: `OTP resent to ${user.phone} successfully`,
                        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
                    });
                } else {
                    console.error(`[AUTH RESEND OTP] SMS failed:`, smsRes.error || smsRes.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to resend SMS OTP. Please try again.'
                    });
                }
            } catch (err) {
                console.error('Failed to resend SMS OTP:', err);
                return res.status(500).json({
                    success: false,
                    message: 'An unexpected error occurred. Please try again.'
                });
            }
        } catch (err) {
            next(err);
        }
    }
);


// Verify OTP - Uses OTP model (independent of user creation)
router.post(
    '/otp/verify',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('code').isString().trim().notEmpty().withMessage('OTP code is required')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email, code } = req.body;

            // Find OTP record for this email
            const otpRecord = await OTP.findOne({
                email: email.toLowerCase(),
                verified: false
            }).sort({ createdAt: -1 });

            if (!otpRecord) {
                return res.status(400).json({
                    success: false,
                    message: 'No active OTP found for this email. Please request a new OTP.'
                });
            }

            if (!otpRecord.isValid()) {
                return res.status(400).json({
                    success: false,
                    message: 'OTP has expired or reached maximum attempts. Please request a new OTP.'
                });
            }

            // Verify via external provider
            if (otpRecord.transactionId) {
                const verifyRes = await otpProviderService.verifySMSOTP(otpRecord.transactionId, code);

                if (verifyRes.success && (verifyRes.data?.success || verifyRes.data?.verified)) {
                    // OTP verified successfully
                    otpRecord.verified = true;
                    otpRecord.verifiedAt = new Date();
                    await otpRecord.save();

                    // Update user's verified status if user exists
                    await User.findOneAndUpdate({ email: email.toLowerCase() }, { otpVerified: true });

                    return res.json({
                        success: true,
                        message: 'Email/Mobile verified successfully'
                    });
                } else {
                    otpRecord.attempts += 1;
                    await otpRecord.save();

                    const errorMessage = verifyRes.error?.message || verifyRes.message || 'Invalid OTP code. Please try again.';
                    return res.status(400).json({
                        success: false,
                        message: errorMessage
                    });
                }
            } else {
                // Fallback for legacy OTP or email (though email is currently commented out)
                if (otpRecord.otp !== code) {
                    otpRecord.attempts += 1;
                    await otpRecord.save();
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid OTP code. Please try again.'
                    });
                }

                // OTP verified successfully
                otpRecord.verified = true;
                otpRecord.verifiedAt = new Date();
                await otpRecord.save();

                // Update user's verified status
                await User.findOneAndUpdate({ email: email.toLowerCase() }, { otpVerified: true });

                return res.json({
                    success: true,
                    message: 'Email/Mobile verified successfully'
                });
            }

        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/login',
    [body('email').isEmail(), body('password').isString().notEmpty()],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password } = req.body;
            const normalizedEmail = String(email)?.toLowerCase() || '';
            const user = await User.findOne({ email: normalizedEmail });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const match = await bcrypt.compare(password, user.passwordHash);
            if (!match) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // ONLY handle 'Pending' check for customer role
            // Admins should always be able to log in even if pending (e.g. initial setup)
            if (user.role === 'customer' && user.status === 'Pending') {
                return res.status(403).json({
                    success: false,
                    message: 'Your account is pending activation. Please complete your signup payment to log in.',
                    status: 'Pending'
                });
            }

            // Compute effective permissions based on role/subrole
            let permissions = {};
            try {
                // For admin/superAdmin, use the Role document matching subrole name
                if ((user.role === 'admin' || user.role === 'superAdmin') && user.subrole) {
                    const roleDoc = await Role.findOne({ name: user.subrole });
                    console.log('roleDoc', roleDoc);
                    if (roleDoc && roleDoc.permissions) {
                        permissions = roleDoc.permissions;
                    }
                }
            } catch (permErr) {
                console.error('Failed to load permissions for user on login:', permErr);
            }

            const token = createToken(user.id);
            const safeUser = user.toSafeJSON();

            return res.json({
                token,
                user: {
                    ...safeUser,
                    permissions,
                },
                success: true,
            });
        } catch (err) {
            next(err);
        }
    }
);

// Activate account after successful payment
router.post(
    '/activate-account',
    [
        body('paymentIntentId').isString().notEmpty().withMessage('Payment Intent ID is required'),
    ],
    authenticateToken,
    async (req, res, next) => {
        try {
            const { paymentIntentId } = req.body;
            const userId = req.user.id;

            // 1. Retrieve the PaymentIntent from Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status !== 'succeeded') {
                return res.status(400).json({
                    success: false,
                    message: `Payment not completed. Current status: ${paymentIntent.status}`
                });
            }

            // 2. Find and activate the user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            user.status = 'Active';
            await user.save();

            console.log(`[AUTH] User ${user.email} activated successfully after payment ${paymentIntentId}`);

            res.json({
                success: true,
                message: 'Account activated successfully. Welcome!',
                user: user.toSafeJSON()
            });

        } catch (err) {
            console.error('[AUTH] Activation failed:', err);
            res.status(500).json({
                success: false,
                message: 'Failed to activate account. Please contact support.'
            });
        }
    }
);

// Simple auth middleware using Bearer token
function authRequired(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });
    try {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const payload = jwt.verify(token, secret);
        req.userId = payload.sub;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

router.get('/me', authRequired, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Load permissions for admin/superAdmin users
        let permissions = {};
        try {
            if ((user.role === 'admin' || user.role === 'superAdmin') && user.subrole) {
                const Role = require('../../models/Role');
                const roleDoc = await Role.findOne({ name: user.subrole });
                if (roleDoc && roleDoc.permissions) {
                    permissions = roleDoc.permissions;
                }
            }
        } catch (permErr) {
            console.error('Failed to load permissions for /me endpoint:', permErr);
        }

        // Get user's selected packages
        const selectedPackages = await PackageSelection.find({
            customerId: req.userId,
            status: 'active'
        })
            .populate('packageId')
            .populate('packageId.providerId', 'firstName lastName email')
            .sort({ selectedAt: -1 });

        const userData = user.toSafeJSON();
        userData.selectedPackages = selectedPackages;
        userData.permissions = permissions;

        return res.json({
            user: userData,
            selectedPackages: selectedPackages
        });
    } catch (err) {
        next(err);
    }
});

// Update user profile
router.put(
    '/update',
    authRequired,
    [
        body('firstName').optional().isString().trim().notEmpty(),
        body('lastName').optional().isString().trim().notEmpty(),
        body('phone').optional().isString().trim(),
        body('serviceAddress').optional().isString().trim(),
        body('type').optional().isIn(['NBN', 'MBL', 'MBB', 'SME']),
        body('mblSelectedNumber').optional().isString().trim(),
        body('mblKeepExistingNumber').optional().isBoolean(),
        body('mblCurrentMobileNumber').optional().isString().trim(),
        body('mblCurrentProvider').optional().isString().trim(),
        body('dateOfBirth').optional().isString().trim(),
        body('identity').optional().custom((value) => {
            if (value === null || value === undefined) return true;
            return typeof value === 'object' && !Array.isArray(value);
        }).withMessage('Identity must be an object or null'),
        body('businessDetails').optional().custom((value) => {
            if (value === null || value === undefined) return true;
            return typeof value === 'object' && !Array.isArray(value);
        }).withMessage('Business details must be an object or null'),
        body('simType').optional().isIn(['eSim', 'physical']),
        // Address information validation
        body('addressInformation.streetAddress').optional().isString().trim(),
        body('addressInformation.suburb').optional().isString().trim(),
        body('addressInformation.city').optional().isString().trim(),
        body('addressInformation.state').optional().isString().trim(),
        body('addressInformation.country').optional().isString().trim(),
        body('addressInformation.postcode').optional().isString().trim(),
        // Notification preferences validation
        body('twoFactorAuthentication').optional().isBoolean(),
        body('emailNotifications').optional().isBoolean(),
        body('smsNotifications').optional().isBoolean(),
        body('marketingCommunications').optional().isBoolean(),
        body('serviceUpdates').optional().isBoolean(),
        body('billingNotifications').optional().isBoolean(),
        body('customerType').optional().isIn(['residential', 'business']).withMessage('Customer type must be residential or business'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const user = await User.findById(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Fields that can be updated
            const allowedFields = [
                'firstName',
                'lastName',
                'phone',
                'serviceAddress',
                'type',
                'mblSelectedNumber',
                'mblKeepExistingNumber',
                'mblCurrentMobileNumber',
                'mblCurrentProvider',
                'dateOfBirth',
                'identity',
                'businessDetails',
                'simType',
                'addressInformation',
                'twoFactorAuthentication',
                'emailNotifications',
                'smsNotifications',
                'marketingCommunications',
                'serviceUpdates',
                'billingNotifications',
                'customerType'
            ];

            // Update only provided fields
            allowedFields.forEach(field => {
                if (req.body.hasOwnProperty(field)) {
                    user[field] = req.body[field];
                }
            });

            await user.save();

            return res.json({
                success: true,
                message: 'User profile updated successfully',
                user: user.toSafeJSON()
            });
        } catch (err) {
            next(err);
        }
    }
);

// Change password
router.put(
    '/change-password',
    authRequired,
    [
        body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { currentPassword, newPassword } = req.body;

            const user = await User.findById(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, 10);

            // Update password
            user.passwordHash = newPasswordHash;
            await user.save();

            return res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (err) {
            next(err);
        }
    }
);

// Check if email already exists
router.post(
    '/check-email',
    [
        body('email').isEmail().withMessage('Valid email is required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email } = req.body;

            const existingUser = await User.findOne({ email });

            return res.json({
                exists: !!existingUser,
                message: existingUser ? 'Email is already registered' : 'Email is available'
            });

        } catch (err) {
            next(err);
        }
    }
);

// Admin: create a user directly from the console
router.post(
    '/createUserByAdmin',
    authenticateToken,
    requireAdmin,
    [
        body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
        body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('subrole')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Subrole is required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            // Check if user has permission to invite users
            // SuperAdmin bypasses permission checks
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasInvitePermission = roleDoc.permissions['user.invite'] === true;
                        if (!hasInvitePermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to invite users'
                            });
                        }
                    }
                }
            }

            const { firstName, lastName, email, subrole } = req.body;
            const normalizedEmail = String(email)?.toLowerCase() || '';

            const existing = await User.findOne({ email: normalizedEmail });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: 'Email is already registered',
                });
            }

            const passwordPlaceholder = crypto.randomBytes(8).toString('hex');
            const passwordHash = await bcrypt.hash(passwordPlaceholder, 10);

            // Set role to 'admin' and subrole to the selected role from dropdown
            const user = await User.create({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: normalizedEmail,
                role: 'admin', // Always set to 'admin' for admin users
                subrole: subrole.trim(), // Store the specific role name (e.g., "Admin", "Content Manager", etc.)
                adminRoleLabel: subrole.trim(), // Keep for backward compatibility
                status: 'Pending',
                passwordHash,
            });

            const inviteLink = `${ADMIN_INVITE_URL}?email=${encodeURIComponent(normalizedEmail)}`;
            sendAdminInviteEmail({
                email: normalizedEmail,
                name: `${firstName.trim()} ${lastName.trim()}`.trim(),
                role: subrole.trim(),
                inviteLink,
                password: passwordPlaceholder,
            }).catch((inviteErr) => {
                console.error('Failed to send admin invite email', inviteErr);
            });

            return res.status(201).json({
                success: true,
                user: formatUserForAdminList(user, 0),
            });
        } catch (err) {
            next(err);
        }
    }
);

// List users for admin (for admin UI)
router.get('/users', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        console.log('listing users');
        // Exclude soft-deleted users and superAdmin users
        const users = await User.find({
            isDeleted: { $ne: true },
            role: { $ne: 'superAdmin' }
        }).sort({ createdAt: -1 });

        // Exclude the currently logged-in admin from the list
        const filtered = users.filter((u) => u._id.toString() !== String(req.user.id));

        const mapped = filtered.map((u, index) => formatUserForAdminList(u, index + 1));

        return res.json({
            success: true,
            users: mapped,
        });
    } catch (err) {
        next(err);
    }
});

// Admin: update another user (name/role – email cannot be changed here)
router.put(
    '/users/:id',
    authenticateToken,
    requireAdmin,
    [
        body('name').optional().isString().trim().notEmpty(),
        body('firstName').optional().isString().trim().notEmpty(),
        body('lastName').optional().isString().trim().notEmpty(),
        body('phone').optional().isString().trim(),
        body('serviceAddress').optional().isString().trim(),
        body('type').optional().isIn(['NBN', 'MBL', 'MBB', 'SME']),
        body('mblSelectedNumber').optional().isString().trim(),
        body('mblKeepExistingNumber').optional().isBoolean(),
        body('mblCurrentMobileNumber').optional().isString().trim(),
        body('mblCurrentProvider').optional().isString().trim(),
        body('role').optional().isString().trim().notEmpty(),
        body('status').optional().isString().trim().notEmpty(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            // Check if user has permission to edit users
            // SuperAdmin bypasses permission checks
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasEditPermission = roleDoc.permissions['user.edit'] === true;
                        if (!hasEditPermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to edit users'
                            });
                        }
                    }
                }
            }

            const { name, role, status, firstName, lastName, phone, serviceAddress, type, mblSelectedNumber, mblKeepExistingNumber, mblCurrentMobileNumber, mblCurrentProvider, customerType } = req.body;
            const userId = req.params.id;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            // Update name (split into first/last)
            if (name) {
                const parts = String(name).trim().split(' ');
                user.firstName = parts[0] || user.firstName;
                user.lastName = parts.slice(1).join(' ') || user.lastName;
            }

            if (firstName) {
                user.firstName = firstName;
            }

            if (lastName) {
                user.lastName = lastName;
            }

            if (phone) {
                user.phone = phone;
            }

            if (serviceAddress) {
                user.serviceAddress = serviceAddress;
            }

            if (type) {
                user.type = type;
            }

            if (mblSelectedNumber) {
                user.mblSelectedNumber = mblSelectedNumber;
            }

            // Update role - map from UI label or raw role value
            if (role) {
                if (ADMIN_ROLE_LABELS.includes(role)) {
                    user.role = 'admin'; // Always set to 'admin' for admin users
                    user.subrole = role; // Store the specific role name
                    user.adminRoleLabel = role; // Keep for backward compatibility
                } else if (['admin', 'support', 'customer'].includes(role)) {
                    user.role = role;
                    user.subrole = null; // Clear subrole for non-admin roles
                    user.adminRoleLabel = DB_ROLE_TO_UI_ROLE[role] || null;
                }
            }

            // Update status for admin UI
            if (status && ['Active', 'Inactive', 'Pending'].includes(status)) {
                user.status = status;
            }

            await user.save();

            // Map back to the same shape as /auth/users
            const mapped = formatUserForAdminList(user, 0);

            return res.json({
                success: true,
                user: mapped,
            });
        } catch (err) {
            next(err);
        }
    }
);

// Admin: soft-delete user (mark as deleted + set status Inactive)
router.delete(
    '/users/:id',
    authenticateToken,
    requireAdmin,
    async (req, res, next) => {
        try {
            // Check if user has permission to delete users
            // SuperAdmin bypasses permission checks
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasDeletePermission = roleDoc.permissions['user.delete'] === true;
                        if (!hasDeletePermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to delete users'
                            });
                        }
                    }
                }
            }

            const userId = req.params.id;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            user.isDeleted = true;
            user.status = 'Inactive';
            await user.save();

            return res.json({
                success: true,
                message: 'User deleted successfully',
            });
        } catch (err) {
            next(err);
        }
    }
);

// Seed an initial admin user (protected by a shared secret)
router.post(
    '/seed-admin',
    [
        body('secret').isString().notEmpty().withMessage('Secret is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
        body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
        body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array(),
                });
            }

            const { secret, email, password, firstName, lastName, phone } = req.body;
            // const expectedSecret = process.env.ADMIN_SEED_SECRET;
            const expectedSecret = 'BLYNK';

            if (!expectedSecret || secret !== expectedSecret) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid seed secret',
                });
            }

            let user = await User.findOne({ email });

            const passwordHash = await bcrypt.hash(password, 10);

            if (user) {
                // Update existing user to admin
                user.firstName = firstName;
                user.lastName = lastName;
                if (phone) user.phone = phone;
                user.passwordHash = passwordHash;
                user.role = 'admin';
                await user.save();
            } else {
                // Create new admin user
                user = await User.create({
                    firstName,
                    lastName,
                    email,
                    phone,
                    passwordHash,
                    role: 'admin',
                });
            }

            const token = createToken(user.id);

            return res.json({
                success: true,
                message: 'Admin user seeded successfully',
                token,
                user: user.toSafeJSON(),
            });
        } catch (err) {
            next(err);
        }
    }
);

router.get('/users/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        return res.json({
            success: true,
            user: user.toSafeJSON(),
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
