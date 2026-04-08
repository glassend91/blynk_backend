const mongoose = require('mongoose');

const billingAccountSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    currentBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    creditLimit: {
        type: Number,
        default: 0,
        min: 0
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'annually'],
        default: 'monthly'
    },
    nextBillingDate: {
        type: Date,
        required: true
    },
    autoPayEnabled: {
        type: Boolean,
        default: false
    },
    defaultPaymentMethod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod'
    },
    billingAddress: {
        name: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: {
            type: String,
            default: 'AU'
        }
    },
    notificationSettings: {
        emailNotifications: {
            type: Boolean,
            default: true
        },
        smsNotifications: {
            type: Boolean,
            default: false
        },
        billingNotifications: {
            type: Boolean,
            default: true
        },
        paymentReminders: {
            type: Boolean,
            default: true
        }
    },
    paymentTerms: {
        type: Number,
        default: 30, // days
        min: 0
    },
    currency: {
        type: String,
        default: 'AUD'
    },
    taxRate: {
        type: Number,
        default: 0.10, // 10% GST for Australia
        min: 0,
        max: 1
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'closed'],
        default: 'active'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Index for efficient queries
billingAccountSchema.index({ customerId: 1 });
billingAccountSchema.index({ nextBillingDate: 1 });
billingAccountSchema.index({ status: 1 });

// Method to check if account is in good standing
billingAccountSchema.methods.isInGoodStanding = function () {
    return this.status === 'active' && this.currentBalance <= this.creditLimit;
};

// Method to add to balance
billingAccountSchema.methods.addToBalance = function (amount) {
    this.currentBalance += amount;
    return this.save();
};

// Method to subtract from balance
billingAccountSchema.methods.subtractFromBalance = function (amount) {
    this.currentBalance = Math.max(0, this.currentBalance - amount);
    return this.save();
};

// Method to calculate next billing date
billingAccountSchema.methods.calculateNextBillingDate = function () {
    const now = new Date();
    let nextDate;

    switch (this.billingCycle) {
        case 'monthly':
            nextDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            break;
        case 'quarterly':
            nextDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
            break;
        case 'annually':
            nextDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            break;
        default:
            nextDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }

    this.nextBillingDate = nextDate;
    return this;
};

module.exports = mongoose.model('BillingAccount', billingAccountSchema);
