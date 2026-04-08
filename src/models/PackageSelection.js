const mongoose = require('mongoose');

const packageSelectionSchema = new mongoose.Schema({
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Selection details
    selectedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled', 'suspended'],
        default: 'active'
    },
    // Payment information
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'debit_card', 'bank_transfer', 'wallet', 'crypto'],
        default: 'credit_card'
    },
    amountPaid: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    // Package validity for this customer
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        default: Date.now
    },
    // Customer's usage for this package
    usedData: {
        type: Number,
        default: 0,
        min: 0
    },
    // Usage tracking
    lastUsageUpdate: {
        type: Date,
        default: Date.now
    },
    // Usage history
    usageHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        action: {
            type: String,
            enum: ['add', 'subtract', 'set'],
            required: true
        },
        note: {
            type: String,
            trim: true
        }
    }],
    // Customer's personal number for this package
    customerNumber: {
        type: String,
        default: '',
        trim: true
    }
}, {
    timestamps: true
});

// Virtual for percentage used by this customer
packageSelectionSchema.virtual('percentageUsed').get(async function () {
    const Package = mongoose.model('Package');
    const package = await Package.findById(this.packageId);
    if (!package || package.totalData === 0) return 0;
    return Math.round((this.usedData / package.totalData) * 100 * 10) / 10;
});

// Virtual for remaining data for this customer
packageSelectionSchema.virtual('remainingData').get(async function () {
    const Package = mongoose.model('Package');
    const package = await Package.findById(this.packageId);
    if (!package) return 0;
    return Math.max(0, package.totalData - this.usedData);
});

// Virtual to check if selection is still valid
packageSelectionSchema.virtual('isValid').get(function () {
    const now = new Date();
    return this.status === 'active' &&
        this.validFrom <= now &&
        this.validUntil >= now;
});

// Method to add usage
packageSelectionSchema.methods.addUsage = function (amount, note = '') {
    this.usedData += amount;
    this.lastUsageUpdate = new Date();
    this.usageHistory.push({
        date: new Date(),
        amount: amount,
        action: 'add',
        note: note
    });
    return this.save();
};

// Method to subtract usage
packageSelectionSchema.methods.subtractUsage = function (amount, note = '') {
    this.usedData = Math.max(0, this.usedData - amount);
    this.lastUsageUpdate = new Date();
    this.usageHistory.push({
        date: new Date(),
        amount: amount,
        action: 'subtract',
        note: note
    });
    return this.save();
};

// Method to set usage
packageSelectionSchema.methods.setUsage = function (amount, note = '') {
    const oldAmount = this.usedData;
    this.usedData = Math.max(0, amount);
    this.lastUsageUpdate = new Date();
    this.usageHistory.push({
        date: new Date(),
        amount: Math.abs(amount - oldAmount),
        action: 'set',
        note: note
    });
    return this.save();
};

// Method to renew package
packageSelectionSchema.methods.renew = function (validityDays) {
    this.validFrom = new Date();
    this.validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    this.status = 'active';
    this.usedData = 0; // Reset usage on renewal
    return this.save();
};

// Ensure virtual fields are serialized
packageSelectionSchema.set('toJSON', { virtuals: true });
packageSelectionSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
packageSelectionSchema.index({ customerId: 1, status: 1 });
packageSelectionSchema.index({ packageId: 1, status: 1 });
// Removed unique constraint to allow multiple selections (cancelled/expired can be re-selected)
packageSelectionSchema.index({ customerId: 1, packageId: 1, status: 1 });
packageSelectionSchema.index({ validUntil: 1, status: 1 });
packageSelectionSchema.index({ selectedAt: -1 });

module.exports = mongoose.model('PackageSelection', packageSelectionSchema);
