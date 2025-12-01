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

const router = express.Router();

// Shared auth middleware for protected admin endpoints
const { authenticateToken, requireAdmin } = require('../../middleware/auth');

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
        body('selectedPlan').optional().isObject().withMessage('Selected plan must be an object'),
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
                selectedPlan,
            } = req.body;

            console.log('body', req.body);

            // Check if email is already registered (only block fully registered users)
            const existing = await User.findOne({ email });
            if (existing) {
                return res.status(409).json({
                    message: 'This email address is already in use. Please log in to your account or contact customer service for assistance.'
                });
            }

            const passwordHash = await bcrypt.hash(password, 10);
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
                passwordHash,
                otpVerified: false,
            });

            const token = createToken(user.id);

            // Send order confirmation email for NBN, MBL, and MBB signups
            if (type === 'NBN' || type === 'MBL' || type === 'MBB') {
                try {
                    const { sendOrderConfirmationEmail } = require('../../utils/emailService');
                    // Use selected plan from request, fallback to default values
                    let planName = 'Plan';
                    let amount = 0;

                    if (type === 'NBN') {
                        planName = (selectedPlan && selectedPlan.name) ? selectedPlan.name : 'NBN Plan';
                        amount = (selectedPlan && selectedPlan.price) ? selectedPlan.price : 69.99;
                    } else if (type === 'MBL') {
                        planName = (selectedPlan && selectedPlan.name) ? selectedPlan.name : 'Mobile Voice Plan';
                        amount = (selectedPlan && selectedPlan.price) ? selectedPlan.price : 35.00;
                    } else if (type === 'MBB') {
                        planName = (selectedPlan && selectedPlan.name) ? selectedPlan.name : 'Mobile Broadband Plan';
                        amount = (selectedPlan && selectedPlan.price) ? selectedPlan.price : 35.00;
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
                    email: email.toLowerCase(),
                    otp,
                    otpExpiry,
                    verified: false,
                    attempts: 0,
                    purpose: 'email_verification'
                });
            }

            // Send OTP email (no user required)
            try {
                await sendOTPEmail(email, otp, 'User'); // Generic name since user doesn't exist yet
                return res.json({
                    success: true,
                    message: 'OTP sent to your email successfully',
                    expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
                });
            } catch (emailError) {
                console.error('Failed to send OTP email:', emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP email. Please try again.'
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
                    email: email.toLowerCase(),
                    otp,
                    otpExpiry,
                    verified: false,
                    attempts: 0,
                    purpose: 'email_verification'
                });
            }

            // Send OTP email (no user required)
            try {
                await sendOTPEmail(email, otp, 'User');
                return res.json({
                    success: true,
                    message: 'OTP resent to your email successfully',
                    expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
                });
            } catch (emailError) {
                console.error('Failed to resend OTP email:', emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to resend OTP email. Please try again.'
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
            const otpRecord = await OTP.getActiveOTP(email);

            if (!otpRecord) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'No OTP found for this email. Please request OTP first.'
                });
            }

            // Check if OTP is expired
            if (new Date() > otpRecord.otpExpiry) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'OTP has expired. Please request a new OTP.'
                });
            }

            // Check attempt limit
            if (otpRecord.attempts >= otpRecord.maxAttempts) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'Too many verification attempts. Please request a new OTP.'
                });
            }

            // Verify OTP
            if (otpRecord.otp !== code) {
                otpRecord.attempts += 1;
                await otpRecord.save();
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'Invalid OTP code. Please try again.',
                    attemptsRemaining: otpRecord.maxAttempts - otpRecord.attempts
                });
            }

            // OTP verified successfully
            otpRecord.verified = true;
            otpRecord.verifiedAt = new Date();
            await otpRecord.save();

            return res.json({
                success: true,
                verified: true,
                message: 'Email verified successfully'
            });
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
            const normalizedEmail = String(email).toLowerCase();
            const user = await User.findOne({ email: normalizedEmail });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const match = await bcrypt.compare(password, user.passwordHash);
            if (!match) {
                return res.status(401).json({ message: 'Invalid email or password' });
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
                'billingNotifications'
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
            const normalizedEmail = String(email).toLowerCase();

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

            const { name, role, status } = req.body;
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

module.exports = router;
