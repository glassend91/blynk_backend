const mongoose = require('mongoose');

const packageUsageSchema = new mongoose.Schema({
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    usedData: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    // Track usage history for analytics
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
    }]
}, {
    timestamps: true
});

// Virtual for percentage used by this user
packageUsageSchema.virtual('percentageUsed').get(async function () {
    const Package = mongoose.model('Package');
    const package = await Package.findById(this.packageId);
    if (!package || package.totalData === 0) return 0;
    return Math.round((this.usedData / package.totalData) * 100 * 10) / 10;
});

// Method to add usage
packageUsageSchema.methods.addUsage = function (amount, note = '') {
    this.usedData += amount;
    this.lastUpdated = new Date();
    this.usageHistory.push({
        date: new Date(),
        amount: amount,
        action: 'add',
        note: note
    });
    return this.save();
};

// Method to subtract usage
packageUsageSchema.methods.subtractUsage = function (amount, note = '') {
    this.usedData = Math.max(0, this.usedData - amount);
    this.lastUpdated = new Date();
    this.usageHistory.push({
        date: new Date(),
        amount: amount,
        action: 'subtract',
        note: note
    });
    return this.save();
};

// Method to set usage
packageUsageSchema.methods.setUsage = function (amount, note = '') {
    const oldAmount = this.usedData;
    this.usedData = Math.max(0, amount);
    this.lastUpdated = new Date();
    this.usageHistory.push({
        date: new Date(),
        amount: Math.abs(amount - oldAmount),
        action: 'set',
        note: note
    });
    return this.save();
};

// Ensure virtual fields are serialized
packageUsageSchema.set('toJSON', { virtuals: true });
packageUsageSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
packageUsageSchema.index({ packageId: 1, userId: 1 }, { unique: true });
packageUsageSchema.index({ userId: 1 });
packageUsageSchema.index({ packageId: 1 });

module.exports = mongoose.model('PackageUsage', packageUsageSchema);
