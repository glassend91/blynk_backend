const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    // Service identification
    serviceName: {
        type: String,
        required: true,
        trim: true
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['NBN', 'Mobile', 'Data Only', 'Voice Only'],
        default: 'Mobile'
    },

    // Service details and specifications
    specifications: {
        // For NBN services
        downloadSpeed: {
            type: Number, // in Mbps
            min: 0
        },
        uploadSpeed: {
            type: Number, // in Mbps
            min: 0
        },
        dataAllowance: {
            type: String, // "Unlimited", "100GB", etc.
            default: 'Unlimited'
        },
        staticIP: {
            type: Boolean,
            default: false
        },

        // For Mobile services
        voiceMinutes: {
            type: String, // "Unlimited", "500", etc.
            default: 'Unlimited'
        },
        smsMessages: {
            type: String, // "Unlimited", "1000", etc.
            default: 'Unlimited'
        },
        internationalCalls: {
            type: Boolean,
            default: false
        },

        // Common specifications
        coverage: {
            type: String,
            trim: true
        },
        network: {
            type: String,
            trim: true
        }
    },

    // Pricing
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'AUD',
        enum: ['AUD', 'USD', 'EUR', 'GBP']
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
    },

    // Service status and availability
    isActive: {
        type: Boolean,
        default: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },

    // Service provider information
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Service description and features
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    features: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        isIncluded: {
            type: Boolean,
            default: true
        }
    }],

    // Add-ons available for this service
    addOns: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: 'AUD'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        type: {
            type: String,
            enum: ['static_ip', 'extra_data', 'international_calls', 'premium_support', 'other'],
            default: 'other'
        }
    }],

    // Service management options
    managementOptions: {
        canPortNumber: {
            type: Boolean,
            default: true
        },
        canOrderSIM: {
            type: Boolean,
            default: true
        },
        canUpgrade: {
            type: Boolean,
            default: true
        },
        canDowngrade: {
            type: Boolean,
            default: true
        },
        canCancel: {
            type: Boolean,
            default: true
        },
        cancellationPolicy: {
            type: String,
            trim: true
        }
    },

    // Service configuration
    configuration: {
        requiresAddress: {
            type: Boolean,
            default: true
        },
        requiresIdentity: {
            type: Boolean,
            default: true
        },
        requiresCreditCheck: {
            type: Boolean,
            default: false
        },
        minimumContractPeriod: {
            type: Number, // in months
            default: 0
        },
        setupFee: {
            type: Number,
            default: 0,
            min: 0
        }
    },

    // Analytics and tracking
    totalSubscriptions: {
        type: Number,
        default: 0,
        min: 0
    },
    activeSubscriptions: {
        type: Number,
        default: 0,
        min: 0
    },

    // Service metadata
    tags: [{
        type: String,
        trim: true
    }],
    category: {
        type: String,
        trim: true,
        default: 'general'
    },

    // Service validity
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date
    }
}, {
    timestamps: true
});

// Virtual for service display name
serviceSchema.virtual('displayName').get(function () {
    return `${this.serviceType} - ${this.serviceName}`;
});

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function () {
    return `${this.currency} $${this.price.toFixed(2)}/${this.billingCycle}`;
});

// Virtual for service status
serviceSchema.virtual('status').get(function () {
    if (!this.isActive) return 'inactive';
    if (!this.isAvailable) return 'unavailable';
    if (this.validUntil && this.validUntil < new Date()) return 'expired';
    return 'active';
});

// Method to get active add-ons
serviceSchema.methods.getActiveAddOns = function () {
    return this.addOns.filter(addon => addon.isActive);
};

// Method to check if service is available for subscription
serviceSchema.methods.isAvailableForSubscription = function () {
    return this.isActive && this.isAvailable && this.status === 'active';
};

// Method to increment subscription count
serviceSchema.methods.incrementSubscriptionCount = function () {
    this.totalSubscriptions += 1;
    this.activeSubscriptions += 1;
    return this.save();
};

// Method to decrement subscription count
serviceSchema.methods.decrementSubscriptionCount = function () {
    this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
    return this.save();
};

// Ensure virtual fields are serialized
serviceSchema.set('toJSON', { virtuals: true });
serviceSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
serviceSchema.index({ serviceType: 1, isActive: 1 });
serviceSchema.index({ isAvailable: 1, isActive: 1 });
serviceSchema.index({ providerId: 1, isActive: 1 });
serviceSchema.index({ price: 1 });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ category: 1 });
serviceSchema.index({ createdAt: -1 });

// Text search index
serviceSchema.index({
    serviceName: 'text',
    description: 'text',
    'features.name': 'text'
});

module

    .exports = mongoose.model('Service', serviceSchema);
