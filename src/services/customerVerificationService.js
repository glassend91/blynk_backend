const mongoose = require('mongoose');
const OTP = require('../models/OTP');
const CustomerVerification = require('../models/CustomerVerification');
const CustomerNote = require('../models/CustomerNote');
const User = require('../models/User');
const BillingAccount = require('../models/BillingAccount');
const PaymentMethod = require('../models/PaymentMethod');
const { sendCustomerVerificationOTPEmail } = require('../utils/emailService');
const Invoice = require('../models/Invoice');

class CustomerVerificationService {
    // Generate a 6-digit OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Send OTP via Email or SMS
    async sendOTP(emailOrPhone, channel, purpose) {
        try {
            if (!emailOrPhone) {
                throw new Error('Email or phone number is required');
            }

            const isEmail = emailOrPhone.includes('@');
            const isPhone = /^\+?[\d\s-]+$/.test(emailOrPhone.replace(/\s/g, ''));

            if (!isEmail && !isPhone) {
                throw new Error('Invalid email or phone number format');
            }

            // Normalize input
            let email = null;
            let phone = null;

            if (isEmail) {
                email = emailOrPhone.trim().toLowerCase();
            } else {
                phone = emailOrPhone.replace(/\s/g, '').replace(/^\+/, '');
            }

            // Find customer by email or phone
            const customer = await User.findOne(
                isEmail ? { email } : { phone }
            );

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Generate OTP
            const otpCode = this.generateOTP();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Create OTP record
            const otpData = {
                otp: otpCode,
                otpExpiry,
                purpose: purpose || 'customer_verification',
                channel: channel || (isEmail ? 'email' : 'sms')
            };

            if (isEmail) {
                otpData.email = email;
            } else {
                otpData.phone = phone;
            }

            const otp = new OTP(otpData);
            await otp.save();

            // Create or update verification record
            await CustomerVerification.findOneAndUpdate(
                { customerId: customer._id, deletedAt: null },
                {
                    customerId: customer._id,
                    email: customer.email,
                    phone: customer.phone,
                    status: 'Pending',
                    verificationMethod: channel === 'sms' ? 'OTP_SMS' : 'OTP_Email'
                },
                { upsert: true, new: true }
            );

            // Send OTP via email if channel is email
            if (channel === 'email' || (!channel && isEmail)) {
                try {
                    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
                    await sendCustomerVerificationOTPEmail(email, otpCode, customerName);
                } catch (emailError) {
                    console.error('Failed to send OTP email:', emailError);
                    // Don't throw error, just log it - OTP is already saved
                    // In production, you might want to handle this differently
                }
            } else if (channel === 'sms' || (!channel && !isEmail)) {
                // TODO: Implement SMS sending service
                console.log(`OTP for phone ${phone}: ${otpCode} (SMS sending not yet implemented)`);
            }

            return {
                success: true,
                message: `OTP sent successfully via ${channel || (isEmail ? 'email' : 'sms')}`,
                // Remove otpCode in production
                otpCode: process.env.NODE_ENV === 'development' ? otpCode : undefined
            };
        } catch (error) {
            throw new Error(`Failed to send OTP: ${error.message}`);
        }
    }

    // Verify OTP manually
    async verifyOTP(emailOrPhone, otpCode, adminNotes, adminId) {
        try {
            if (!emailOrPhone || !otpCode) {
                throw new Error('Email/phone and OTP code are required');
            }

            const isEmail = emailOrPhone.includes('@');
            const email = isEmail ? emailOrPhone.trim().toLowerCase() : null;
            const phone = !isEmail ? emailOrPhone.replace(/\s/g, '').replace(/^\+/, '') : null;

            // Find customer
            const customer = await User.findOne(
                isEmail ? { email } : { phone }
            );

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Find and verify OTP
            const otp = await OTP.findOne({
                [isEmail ? 'email' : 'phone']: isEmail ? email : phone,
                otp: otpCode,
                verified: false
            }).sort({ createdAt: -1 });

            if (!otp) {
                // Mark verification as failed
                await CustomerVerification.findOneAndUpdate(
                    { customerId: customer._id, deletedAt: null },
                    {
                        status: 'Failed',
                        failedAt: new Date(),
                        failureReason: 'Invalid OTP code',
                        adminNotes: adminNotes || ''
                    },
                    { upsert: true, new: true }
                );
                throw new Error('Invalid OTP code');
            }

            if (!otp.isValid()) {
                await CustomerVerification.findOneAndUpdate(
                    { customerId: customer._id, deletedAt: null },
                    {
                        status: 'Failed',
                        failedAt: new Date(),
                        failureReason: 'OTP expired or exceeded max attempts',
                        adminNotes: adminNotes || ''
                    },
                    { upsert: true, new: true }
                );
                throw new Error('OTP has expired or exceeded maximum attempts');
            }

            // Mark OTP as verified
            otp.verified = true;
            otp.verifiedAt = new Date();
            await otp.save();

            // Update verification record
            const verification = await CustomerVerification.findOneAndUpdate(
                { customerId: customer._id, deletedAt: null },
                {
                    status: 'Verified',
                    verifiedAt: new Date(),
                    verificationMethod: 'Manual',
                    adminNotes: adminNotes || '',
                    verifiedBy: adminId
                },
                { upsert: true, new: true }
            );

            return verification.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to verify OTP: ${error.message}`);
        }
    }

    // Manual verification (mark as verified without OTP)
    async manualVerification(customerIdOrEmail, adminNotes, adminId) {
        try {
            // Find customer
            const customer = await User.findOne(
                customerIdOrEmail.includes('@')
                    ? { email: customerIdOrEmail.trim().toLowerCase() }
                    : { _id: customerIdOrEmail }
            );

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Update verification record
            const verification = await CustomerVerification.findOneAndUpdate(
                { customerId: customer._id, deletedAt: null },
                {
                    customerId: customer._id,
                    email: customer.email,
                    phone: customer.phone,
                    status: 'Verified',
                    verifiedAt: new Date(),
                    verificationMethod: 'Manual',
                    adminNotes: adminNotes || '',
                    verifiedBy: adminId
                },
                { upsert: true, new: true }
            );

            return verification.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to manually verify customer: ${error.message}`);
        }
    }

    // Get statistics
    async getStatistics() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const baseQuery = { deletedAt: null };

            const pendingVerification = await CustomerVerification.countDocuments({
                ...baseQuery,
                status: 'Pending'
            });

            const verifiedToday = await CustomerVerification.countDocuments({
                ...baseQuery,
                status: 'Verified',
                verifiedAt: { $gte: today, $lt: tomorrow }
            });

            const failedVerifications = await CustomerVerification.countDocuments({
                ...baseQuery,
                status: 'Failed',
                failedAt: { $gte: today, $lt: tomorrow }
            });

            const otpsSentToday = await OTP.countDocuments({
                purpose: 'customer_verification',
                createdAt: { $gte: today, $lt: tomorrow }
            });

            return {
                pendingVerification,
                verifiedToday,
                failedVerifications,
                otpsSentToday
            };
        } catch (error) {
            throw new Error(`Failed to fetch statistics: ${error.message}`);
        }
    }

    // Create customer note
    async createCustomerNote(data) {
        try {
            const { customerId, noteType, priority, content, tags, isCritical, createdBy } = data;

            if (!customerId || !content || !createdBy) {
                throw new Error('Missing required fields: customerId, content, and createdBy are required');
            }

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer) {
                throw new Error('Customer not found');
            }

            const note = new CustomerNote({
                customerId,
                noteType: noteType || 'General',
                priority: priority || 'Medium',
                content: content.trim(),
                tags: tags ? tags.map(t => t.trim()).filter(Boolean) : [],
                isCritical: isCritical === true || isCritical === 'true',
                createdBy
            });

            await note.save();
            return note.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to create customer note: ${error.message}`);
        }
    }

    // Get customer notes
    async getCustomerNotes(customerId) {
        try {
            const notes = await CustomerNote.find({
                customerId,
                deletedAt: null
            })
                .populate('customerId', 'firstName lastName email')
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .lean();

            return notes.map(note => ({
                id: note._id.toString(),
                customerId: note.customerId._id ? note.customerId._id.toString() : note.customerId.toString(),
                customer: note.customerId.firstName ? {
                    firstName: note.customerId.firstName,
                    lastName: note.customerId.lastName,
                    email: note.customerId.email
                } : undefined,
                noteType: note.noteType,
                priority: note.priority,
                content: note.content,
                tags: note.tags || [],
                isCritical: note.isCritical || false,
                createdBy: note.createdBy._id ? {
                    id: note.createdBy._id.toString(),
                    firstName: note.createdBy.firstName,
                    lastName: note.createdBy.lastName,
                    email: note.createdBy.email
                } : { id: note.createdBy.toString() },
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString()
            }));
        } catch (error) {
            throw new Error(`Failed to fetch customer notes: ${error.message}`);
        }
    }

    // Search customers and get their notes
    async searchCustomersAndNotes(searchQuery) {
        try {
            if (!searchQuery || !searchQuery.trim()) {
                throw new Error('Search query is required');
            }

            const query = searchQuery.trim().toLowerCase();
            const isEmail = query.includes('@');
            const isPhone = /^\+?[\d\s-]+$/.test(query.replace(/\s/g, ''));

            let customers = [];

            if (isEmail) {
                customers = await User.find({
                    email: { $regex: query, $options: 'i' },
                    role: 'customer'
                }).limit(10).lean();
            } else if (isPhone) {
                const phoneClean = query.replace(/\s/g, '').replace(/^\+/, '');
                customers = await User.find({
                    phone: { $regex: phoneClean, $options: 'i' },
                    role: 'customer'
                }).limit(10).lean();
            } else {
                // Search by name
                customers = await User.find({
                    $or: [
                        { firstName: { $regex: query, $options: 'i' } },
                        { lastName: { $regex: query, $options: 'i' } },
                        { email: { $regex: query, $options: 'i' } }
                    ],
                    role: 'customer'
                }).limit(10).lean();
            }

            if (customers.length === 0) {
                return [];
            }

            // Get all notes for these customers
            const customerIds = customers.map(c => c._id);
            const notes = await CustomerNote.find({
                customerId: { $in: customerIds },
                deletedAt: null
            })
                .populate('customerId', 'firstName lastName email')
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .lean();

            // Format notes with customer info
            return notes.map(note => ({
                id: note._id.toString(),
                customerId: note.customerId._id ? note.customerId._id.toString() : note.customerId.toString(),
                customer: note.customerId.firstName ? {
                    firstName: note.customerId.firstName,
                    lastName: note.customerId.lastName,
                    email: note.customerId.email
                } : undefined,
                noteType: note.noteType,
                priority: note.priority,
                content: note.content,
                tags: note.tags || [],
                isCritical: note.isCritical || false,
                createdBy: note.createdBy._id ? {
                    id: note.createdBy._id.toString(),
                    firstName: note.createdBy.firstName,
                    lastName: note.createdBy.lastName,
                    email: note.createdBy.email
                } : { id: note.createdBy.toString() },
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString()
            }));
        } catch (error) {
            throw new Error(`Failed to search customers and notes: ${error.message}`);
        }
    }

    // Global customer search - searches across all customer fields
    async globalCustomerSearch(searchQuery) {
        try {
            if (!searchQuery || !searchQuery.trim()) {
                throw new Error('Search query is required');
            }

            const query = searchQuery.trim();
            const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

            // Clean phone number for search (remove spaces, dashes, plus signs)
            const phoneClean = query.replace(/[\s\-+]/g, '');
            const phoneRegex = phoneClean ? new RegExp(phoneClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

            // Build comprehensive search query
            const searchConditions = [
                // First Name
                { firstName: searchRegex },
                // Last Name
                { lastName: searchRegex },
                // Full Name (combined)
                { $expr: { $regexMatch: { input: { $concat: ['$firstName', ' ', '$lastName'] }, regex: searchRegex } } },
                // Email
                { email: searchRegex },
                // Phone (MSISDN) - search in multiple phone fields
                phoneRegex ? { phone: phoneRegex } : null,
                phoneRegex ? { 'mblSelectedNumber': phoneRegex } : null,
                phoneRegex ? { 'mblCurrentMobileNumber': phoneRegex } : null,
                // Customer ID / Account Number (MongoDB ObjectId or string)
                mongoose.Types.ObjectId.isValid(query) ? { _id: new mongoose.Types.ObjectId(query) } : null,
                // Service Address
                { serviceAddress: searchRegex },
                // Business Name
                { 'businessDetails.businessName': searchRegex },
                // ABN / ACN
                { 'businessDetails.ABN': searchRegex },
                // Business Address
                { 'businessDetails.businessAddress': searchRegex },
                // Address Information fields
                { 'addressInformation.streetAddress': searchRegex },
                { 'addressInformation.suburb': searchRegex },
                { 'addressInformation.city': searchRegex },
                { 'addressInformation.postcode': searchRegex },
            ].filter(Boolean); // Remove null values

            // Search for customers with role 'customer' and not deleted
            const customers = await User.find({
                $or: searchConditions,
                role: 'customer',
                isDeleted: { $ne: true }
            })
                .limit(50) // Limit results to 50
                .sort({ createdAt: -1 }) // Most recent first
                .lean();

            // Format customer data for response
            return customers.map(customer => ({
                id: customer._id.toString(),
                userId: customer._id.toString(),
                firstName: customer.firstName || '',
                lastName: customer.lastName || '',
                email: customer.email || '',
                phone: customer.phone || '',
                serviceAddress: customer.serviceAddress || '',
                type: customer.type || '-',
                customerType: customer.customerType || 'residential',
                status: customer.status || 'Active',
                businessName: customer.businessDetails?.businessName || null,
                ABN: customer.businessDetails?.ABN || null,
                addressInformation: customer.addressInformation || null,
                createdAt: customer.createdAt ? customer.createdAt.toISOString() : null,
                updatedAt: customer.updatedAt ? customer.updatedAt.toISOString() : null,
            }));
        } catch (error) {
            throw new Error(`Failed to perform global customer search: ${error.message}`);
        }
    }

    // Get customer financial data
    async getCustomerFinancialData(customerId) {
        try {
            if (!customerId) {
                throw new Error('Customer ID is required');
            }

            // Validate customer ID
            if (!mongoose.Types.ObjectId.isValid(customerId)) {
                throw new Error('Invalid customer ID format');
            }

            // Find customer
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                throw new Error('Customer not found');
            }

            // Get or create billing account
            let billingAccount = await BillingAccount.findOne({ customerId });
            if (!billingAccount) {
                // Create default billing account
                billingAccount = new BillingAccount({
                    customerId,
                    currentBalance: 0,
                    creditLimit: 0,
                    billingCycle: 'monthly',
                    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                    autoPayEnabled: customer.autoPayEnabled || false,
                });
                billingAccount.calculateNextBillingDate();
                await billingAccount.save();
            }

            // Get default payment method
            let paymentMethod = null;
            let paymentMethodDisplay = null;

            if (billingAccount.defaultPaymentMethod) {
                paymentMethod = await PaymentMethod.findById(billingAccount.defaultPaymentMethod);
            } else {
                // Try to find default payment method for user
                paymentMethod = await PaymentMethod.findOne({
                    user: customerId,
                    isDefault: true,
                    isActive: true,
                });
            }

            if (paymentMethod) {
                if (paymentMethod.type === 'card' && paymentMethod.card) {
                    const brand = paymentMethod.card.brand || 'Card';
                    const last4 = paymentMethod.card.last4 || '****';
                    paymentMethodDisplay = `${brand.charAt(0).toUpperCase() + brand.slice(1)} ending in ${last4}`;
                } else if (paymentMethod.type === 'bank_account' && paymentMethod.bankAccount) {
                    const bankName = paymentMethod.bankAccount.bankName || 'Bank';
                    const last4 = paymentMethod.bankAccount.last4 || '****';
                    paymentMethodDisplay = `${bankName} ending in ${last4}`;
                } else {
                    paymentMethodDisplay = 'Payment method on file';
                }
            }

            // Get next bill due date from upcoming invoice
            let nextBillDueDate = null;
            const upcomingInvoice = await Invoice.findOne({
                customerId,
                status: { $in: ['draft', 'sent'] },
                dueDate: { $gte: new Date() },
            })
                .sort({ dueDate: 1 })
                .limit(1);

            if (upcomingInvoice) {
                nextBillDueDate = upcomingInvoice.dueDate;
            } else if (billingAccount.nextBillingDate) {
                // Calculate due date based on billing cycle and payment terms
                const dueDate = new Date(billingAccount.nextBillingDate);
                dueDate.setDate(dueDate.getDate() + (billingAccount.paymentTerms || 30));
                nextBillDueDate = dueDate;
            }

            // Calculate account balance
            // In the frontend: negative = Credit (CR), positive = Debit (DR)
            // BillingAccount.currentBalance represents amount owed (positive) or credit (negative)
            // Since the schema has min: 0, we'll treat:
            // - Positive balance = Debit (amount owed)
            // - Zero balance = No balance
            // - For credits, we'd need to track overpayments separately or allow negative balances
            // For now, we'll return balance as positive (debit) if > 0
            const rawBalance = billingAccount.currentBalance || 0;

            // If balance is 0, return 0 (no balance)
            // If balance > 0, return as positive (debit/amount owed)
            // Note: Credits would need separate tracking or negative balance support
            const accountBalance = rawBalance;

            return {
                accountBalance: accountBalance, // Positive = Debit (amount owed), Negative = Credit (overpayment)
                nextBillDueDate: nextBillDueDate ? nextBillDueDate.toISOString() : null,
                autoPayStatus: billingAccount.autoPayEnabled || customer.autoPayEnabled ? 'Active' : 'Inactive',
                paymentMethod: paymentMethodDisplay,
            };
        } catch (error) {
            throw new Error(`Failed to fetch customer financial data: ${error.message}`);
        }
    }

    // Get all notes (recent interactions)
    async getAllNotes(filters = {}) {
        try {
            const query = { deletedAt: null };

            if (filters.customerId) {
                query.customerId = filters.customerId;
            }

            if (filters.noteType) {
                query.noteType = filters.noteType;
            }

            if (filters.search) {
                const searchRegex = new RegExp(filters.search, 'i');
                query.$or = [
                    { content: searchRegex },
                    { tags: { $in: [searchRegex] } }
                ];
            }

            const notes = await CustomerNote.find(query)
                .populate('customerId', 'firstName lastName email')
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .limit(filters.limit || 50)
                .lean();

            console.log('notes', notes);

            return notes.map(note => ({
                id: note?._id.toString(),
                customerId: note?.customerId?._id ? note?.customerId?._id.toString() : note?.customerId?.toString(),
                customer: note?.customerId?.firstName ? {
                    firstName: note?.customerId?.firstName,
                    lastName: note?.customerId?.lastName,
                    email: note?.customerId?.email
                } : undefined,
                noteType: note?.noteType,
                priority: note?.priority,
                content: note?.content,
                tags: note?.tags || [],
                isCritical: note?.isCritical || false,
                createdBy: note?.createdBy?._id ? {
                    id: note?.createdBy?._id.toString(),
                    firstName: note?.createdBy?.firstName,
                    lastName: note?.createdBy?.lastName,
                    email: note?.createdBy?.email
                } : { id: note?.createdBy?.toString() },
                createdAt: note?.createdAt?.toISOString(),
                updatedAt: note?.updatedAt?.toISOString()
            }));
        } catch (error) {
            throw new Error(`Failed to fetch notes: ${error.message}`);
        }
    }
}

module.exports = new CustomerVerificationService();

