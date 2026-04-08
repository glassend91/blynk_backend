const mongoose = require('mongoose');

const serviceSubscriptionSchema = new mongoose.Schema({
    // Service and user references
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: false
    },
    wholesalerPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WholesalerPlan',
        required: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Subscription details
    subscriptionStatus: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'cancelled', 'pending', 'expired'],
        default: 'pending'
    },

    // Service assignment details
    assignedNumber: {
        type: String,
        trim: true
    },
    assignedAddress: {
        streetAddress: { type: String, trim: true },
        suburb: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postcode: { type: String, trim: true },
        country: { type: String, trim: true, default: 'Australia' }
    },

    // Subscription dates
    subscribedAt: {
        type: Date,
        default: Date.now
    },
    activatedAt: {
        type: Date
    },
    expiresAt: {
        type: Date
    },
    cancelledAt: {
        type: Date
    },

    // Payment information
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded', 'overdue'],
        default: 'pending'
    },
    paymentMethodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod'
    },
    nextBillingDate: {
        type: Date
    },

    // Pricing for this subscription
    subscriptionPrice: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'AUD'
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },

    // Add-ons selected by user
    selectedAddOns: [{
        addOnId: {
            type: String, // Reference to add-on from service
            required: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],

    // Service configuration
    configuration: {
        autoPay: {
            type: Boolean,
            default: false
        },
        emailNotifications: {
            type: Boolean,
            default: true
        },
        smsNotifications: {
            type: Boolean,
            default: true
        },
        usageAlerts: {
            type: Boolean,
            default: true
        },
        usageThreshold: {
            type: Number,
            default: 80, // Percentage
            min: 0,
            max: 100
        }
    },

    // Usage tracking
    usageData: {
        totalUsed: {
            type: Number,
            default: 0,
            min: 0
        },
        lastUsageUpdate: {
            type: Date,
            default: Date.now
        },
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
            type: {
                type: String,
                enum: ['data', 'voice', 'sms'],
                required: true
            },
            note: {
                type: String,
                trim: true
            }
        }]
    },

    // Service management
    managementHistory: [{
        action: {
            type: String,
            enum: ['activated', 'suspended', 'resumed', 'cancelled', 'upgraded', 'downgraded', 'addon_added', 'addon_removed'],
            required: true
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        performedAt: {
            type: Date,
            default: Date.now
        },
        reason: {
            type: String,
            trim: true
        },
        details: {
            type: Object
        }
    }],

    // Notes and comments
    notes: [{
        note: {
            type: String,
            required: true,
            trim: true
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isInternal: {
            type: Boolean,
            default: false
        }
    }],

    // Contract and terms
    contractTerms: {
        minimumPeriod: {
            type: Number, // in months
            default: 0
        },
        cancellationFee: {
            type: Number,
            default: 0,
            min: 0
        },
        earlyTerminationFee: {
            type: Number,
            default: 0,
            min: 0
        }
    }
}, {
    timestamps: true
});

// Virtual for total price including add-ons
serviceSubscriptionSchema.virtual('totalPrice').get(function () {
    const addOnsPrice = this.selectedAddOns
        .filter(addon => addon.isActive)
        .reduce((total, addon) => total + addon.price, 0);
    return this.subscriptionPrice + addOnsPrice;
});

// Virtual for formatted total price
serviceSubscriptionSchema.virtual('formattedTotalPrice').get(function () {
    return `${this.currency} $${this.totalPrice.toFixed(2)}/${this.billingCycle}`;
});

// Virtual for subscription duration
serviceSubscriptionSchema.virtual('duration').get(function () {
    if (!this.subscribedAt || !this.expiresAt) return null;
    const duration = this.expiresAt - this.subscribedAt;
    return Math.ceil(duration / (1000 * 60 * 60 * 24 * 30)); // months
});

// Virtual for days until expiry
serviceSubscriptionSchema.virtual('daysUntilExpiry').get(function () {
    if (!this.expiresAt) return null;
    const now = new Date();
    const diffTime = this.expiresAt - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to activate subscription
serviceSubscriptionSchema.methods.activate = function () {
    this.subscriptionStatus = 'active';
    this.activatedAt = new Date();
    this.addManagementHistory('activated', null, 'Subscription activated');
    return this.save();
};

// Method to suspend subscription
serviceSubscriptionSchema.methods.suspend = function (reason = '') {
    this.subscriptionStatus = 'suspended';
    this.addManagementHistory('suspended', null, reason);
    return this.save();
};

// Method to cancel subscription
serviceSubscriptionSchema.methods.cancel = function (reason = '') {
    this.subscriptionStatus = 'cancelled';
    this.cancelledAt = new Date();
    this.addManagementHistory('cancelled', null, reason);
    return this.save();
};

// Method to add management history
serviceSubscriptionSchema.methods.addManagementHistory = function (action, performedBy, reason, details = {}) {
    this.managementHistory.push({
        action,
        performedBy,
        reason,
        details
    });
};

// Method to add usage
serviceSubscriptionSchema.methods.addUsage = function (amount, type, note = '') {
    this.usageData.totalUsed += amount;
    this.usageData.lastUsageUpdate = new Date();
    this.usageData.usageHistory.push({
        amount,
        type,
        note
    });
    return this.save();
};

// Method to add add-on
serviceSubscriptionSchema.methods.addAddOn = function (addOnData) {
    this.selectedAddOns.push({
        addOnId: addOnData.addOnId,
        name: addOnData.name,
        price: addOnData.price,
        isActive: true
    });
    this.addManagementHistory('addon_added', null, `Added add-on: ${addOnData.name}`);
    return this.save();
};

// Method to remove add-on
serviceSubscriptionSchema.methods.removeAddOn = function (addOnId) {
    const addOn = this.selectedAddOns.find(a => a.addOnId === addOnId);
    if (addOn) {
        addOn.isActive = false;
        this.addManagementHistory('addon_removed', null, `Removed add-on: ${addOn.name}`);
    }
    return this.save();
};

// Static method to get active subscriptions for user
serviceSubscriptionSchema.statics.getActiveForUser = function (userId) {
    return this.find({
        userId,
        subscriptionStatus: { $in: ['active', 'pending'] }
    }).populate([
        { path: 'serviceId' },
        { path: 'wholesalerPlanId' },
        { path: 'paymentMethodId' }
    ]);
};

// Static method to get all subscriptions for user
serviceSubscriptionSchema.statics.getAllForUser = function (userId) {
    return this.find({ userId }).populate([
        { path: 'serviceId' },
        { path: 'wholesalerPlanId' },
        { path: 'paymentMethodId' }
    ]);
};

// Ensure virtual fields are serialized
serviceSubscriptionSchema.set('toJSON', { virtuals: true });
serviceSubscriptionSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
serviceSubscriptionSchema.index({ userId: 1, subscriptionStatus: 1 });
serviceSubscriptionSchema.index({ serviceId: 1, subscriptionStatus: 1 });
serviceSubscriptionSchema.index({ userId: 1, serviceId: 1 });
serviceSubscriptionSchema.index({ subscriptionStatus: 1 });
serviceSubscriptionSchema.index({ nextBillingDate: 1 });
serviceSubscriptionSchema.index({ expiresAt: 1 });
serviceSubscriptionSchema.index({ subscribedAt: -1 });

// Ensure one active subscription per service per user
serviceSubscriptionSchema.index(
    { userId: 1, serviceId: 1, subscriptionStatus: 1 },
    {
        unique: true,
        partialFilterExpression: { subscriptionStatus: 'active' }
    }
);

module.exports = mongoose.model('ServiceSubscription', serviceSubscriptionSchema);
