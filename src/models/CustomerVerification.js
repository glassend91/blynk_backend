const mongoose = require('mongoose');

const customerVerificationSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        index: true
    },
    phone: {
        type: String,
        trim: true,
        index: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Verified', 'Failed'],
        default: 'Pending'
    },
    verificationMethod: {
        type: String,
        enum: ['OTP_Email', 'OTP_SMS', 'Manual'],
        default: 'OTP_Email'
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    failedAt: {
        type: Date,
        default: null
    },
    failureReason: {
        type: String,
        trim: true,
        default: ''
    },
    adminNotes: {
        type: String,
        trim: true,
        default: ''
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for faster queries
customerVerificationSchema.index({ customerId: 1, deletedAt: 1 });
customerVerificationSchema.index({ status: 1, deletedAt: 1 });
customerVerificationSchema.index({ verifiedAt: 1 });
customerVerificationSchema.index({ createdAt: -1 });
customerVerificationSchema.index({ deletedAt: 1 });

// Method to convert to safe JSON
customerVerificationSchema.methods.toSafeJSON = function () {
    return {
        id: this._id.toString(),
        customerId: this.customerId.toString(),
        email: this.email || undefined,
        phone: this.phone || undefined,
        status: this.status,
        verificationMethod: this.verificationMethod,
        verifiedAt: this.verifiedAt ? this.verifiedAt.toISOString() : undefined,
        failedAt: this.failedAt ? this.failedAt.toISOString() : undefined,
        failureReason: this.failureReason || undefined,
        adminNotes: this.adminNotes || undefined,
        verifiedBy: this.verifiedBy ? this.verifiedBy.toString() : undefined,
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
    };
};

const CustomerVerification = mongoose.model('CustomerVerification', customerVerificationSchema);

module.exports = CustomerVerification;

