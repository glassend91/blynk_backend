const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        firstName: { type: String, trim: true, required: true },
        lastName: { type: String, trim: true, required: true },
        email: { type: String, trim: true, lowercase: true, unique: true, required: true },
        phone: { type: String, trim: true },
        serviceAddress: { type: String, trim: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ['customer', 'admin', 'support', 'contentEditor', 'technicalSupport', 'supportManager', 'administrator', 'superAdmin'], default: 'customer' },
        subrole: { type: String, trim: true }, // For admin users: stores the specific role name from Roles collection (e.g., "Admin", "Content Manager", "Support Agent", "Technician Manager")
        adminRoleLabel: { type: String, trim: true },
        type: { type: String, enum: ['NBN', 'MBL', 'MBB', 'SME', '-'], default: '-' },
        // MBL specific fields (optional)
        mblSelectedNumber: { type: String, trim: true },
        mblKeepExistingNumber: { type: Boolean, default: false },
        mblCurrentMobileNumber: { type: String, trim: true },
        mblCurrentProvider: { type: String, trim: true },
        // OTP fields moved to separate OTP model
        // General user fields
        dateOfBirth: { type: String, trim: true },
        billingAddress: { type: String, trim: true },
        // Identity verification (Driver's Licence etc.)
        identity: {
            idType: { type: String, trim: true },
            firstName: { type: String, trim: true },
            lastName: { type: String, trim: true },
            dateOfBirth: { type: String, trim: true },
            // Driver's Licence fields
            licenceNumber: { type: String, trim: true },
            stateOfIssue: { type: String, trim: true },
            // Passport fields
            passportNumber: { type: String, trim: true },
            countryOfIssue: { type: String, trim: true },
            // Medical Card fields
            medicareCardNumber: { type: String, trim: true },
            IRN: { type: String, trim: true },
            expiryDate: { type: String, trim: true },
            // Verification status
            verified: { type: Boolean, default: false },
            verificationDate: { type: Date },
            verificationProvider: { type: String, trim: true },
            verificationConfidence: { type: Number, min: 0, max: 100 },
            verificationDetails: { type: Object },
            verificationAttempts: { type: Number, default: 0 },
            lastVerificationAttempt: { type: Date },
        },

        businessDetails: {
            businessName: { type: String, trim: true },
            businessAddress: { type: String, trim: true },
            businessType: { type: String, trim: true },
            ABN: { type: String, trim: true },
            primaryContact: {
                firstName: { type: String, trim: true },
                lastName: { type: String, trim: true },
                phone: { type: String, trim: true },
                email: { type: String, trim: true },
            }
        },
        simType: { type: String, enum: ['eSim', 'physical'], default: 'eSim' },
        // Address information (optional)
        addressInformation: {
            streetAddress: { type: String, trim: true },
            suburb: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            country: { type: String, trim: true },
            postcode: { type: String, trim: true },
        },
        // Stripe integration
        stripeCustomerId: { type: String, trim: true },

        // Payment and billing preferences
        autoPayEnabled: { type: Boolean, default: false },

        // Notification preferences
        twoFactorAuthentication: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: true },
        marketingCommunications: { type: Boolean, default: true },
        serviceUpdates: { type: Boolean, default: true },
        billingNotifications: { type: Boolean, default: true },

        // Admin UI status (Active / Inactive / Pending)
        status: { type: String, enum: ['Active', 'Inactive', 'Pending'], default: 'Active' },

        // Soft delete flag for admin operations
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
    return {
        id: this._id,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        role: this.role,
        phone: this.phone,
        serviceAddress: this.serviceAddress,
        type: this.type,
        mblSelectedNumber: this.mblSelectedNumber,
        mblKeepExistingNumber: this.mblKeepExistingNumber,
        mblCurrentMobileNumber: this.mblCurrentMobileNumber,
        mblCurrentProvider: this.mblCurrentProvider,
        dateOfBirth: this.dateOfBirth,
        identity: this.identity,
        simType: this.simType,
        addressInformation: this.addressInformation,
        twoFactorAuthentication: this.twoFactorAuthentication,
        emailNotifications: this.emailNotifications,
        smsNotifications: this.smsNotifications,
        marketingCommunications: this.marketingCommunications,
        serviceUpdates: this.serviceUpdates,
        billingNotifications: this.billingNotifications,
        subrole: this.subrole,
        adminRoleLabel: this.adminRoleLabel,
        status: this.status,
        isDeleted: this.isDeleted,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

module.exports = mongoose.model('User', userSchema);
