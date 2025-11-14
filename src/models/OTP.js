const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true // For fast lookups
    },
    otp: {
        type: String,
        required: true
    },
    otpExpiry: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 } // Auto-delete expired OTPs
    },
    verified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 5
    },
    purpose: {
        type: String,
        enum: ['email_verification', 'number_porting', 'password_reset'],
        default: 'email_verification'
    }
}, {
    timestamps: true
});

// Index for efficient queries
otpSchema.index({ email: 1, verified: 1 });
otpSchema.index({ email: 1, otp: 1 });
otpSchema.index({ email: 1, createdAt: -1 }); // For getting most recent OTP

// Method to check if OTP is valid
otpSchema.methods.isValid = function() {
    return !this.verified && 
           this.attempts < this.maxAttempts && 
           new Date() < this.otpExpiry;
};

// Static method to get active OTP for email
otpSchema.statics.getActiveOTP = async function(email) {
    return await this.findOne({ 
        email: email.toLowerCase(),
        verified: false
    }).sort({ createdAt: -1 }); // Get most recent
};

// Static method to mark OTP as verified
otpSchema.statics.markAsVerified = async function(email, otp) {
    const otpRecord = await this.findOne({ 
        email: email.toLowerCase(),
        otp,
        verified: false
    });
    
    if (otpRecord && otpRecord.isValid()) {
        otpRecord.verified = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();
        return true;
    }
    return false;
};

module.exports = mongoose.model('OTP', otpSchema);

