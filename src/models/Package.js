const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    planTitle: {
        type: String,
        required: true,
        trim: true
    },
    planType: {
        type: String,
        required: true,
        enum: ['Mobile Plan', 'Data Only', 'Voice Plan', 'Unlimited Plan'],
        default: 'Mobile Plan'
    },
    associatedNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    totalData: {
        type: Number,
        required: true,
        min: 0
    },
    resetDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Provider who created this package (package provider)
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Package pricing and availability
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'AUD']
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    // Package description and features
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    features: [{
        type: String,
        trim: true
    }],
    // Package validity period
    validityDays: {
        type: Number,
        required: true,
        min: 1
    },
    // Total usage across all customers
    totalUsedData: {
        type: Number,
        default: 0,
        min: 0
    },
    // Number of customers who selected this package
    customerCount: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

// Virtual for percentage used (total usage across all customers)
packageSchema.virtual('percentageUsed').get(function () {
    if (this.totalData === 0) return 0;
    return Math.round((this.totalUsedData / this.totalData) * 100 * 10) / 10;
});

// Virtual for remaining data
packageSchema.virtual('remainingData').get(function () {
    return Math.max(0, this.totalData - this.totalUsedData);
});

// Virtual for average usage per customer
packageSchema.virtual('averageUsagePerCustomer').get(function () {
    if (this.customerCount === 0) return 0;
    return Math.round((this.totalUsedData / this.customerCount) * 100) / 100;
});

// Ensure virtual fields are serialized
packageSchema.set('toJSON', { virtuals: true });
packageSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
packageSchema.index({ providerId: 1, isActive: 1 });
packageSchema.index({ isAvailable: 1, isActive: 1 });
packageSchema.index({ planType: 1, isActive: 1 });
packageSchema.index({ associatedNumber: 1 });
packageSchema.index({ price: 1 });
packageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Package', packageSchema);