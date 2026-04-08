const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        stripePaymentMethodId: {
            type: String,
            required: true,
            unique: true
        },
        stripeCustomerId: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['card', 'bank_account'],
            default: 'card'
        },
        card: {
            brand: { type: String }, // visa, mastercard, amex, etc.
            last4: { type: String },
            expMonth: { type: Number },
            expYear: { type: Number },
            funding: { type: String }, // credit, debit, prepaid, unknown
            country: { type: String },
            cvcCheck: { type: String }, // pass, fail, unavailable, unchecked
            addressLine1Check: { type: String },
            addressPostalCodeCheck: { type: String }
        },
        bankAccount: {
            bankName: { type: String },
            last4: { type: String },
            routingNumber: { type: String },
            accountType: { type: String }, // checking, savings
            country: { type: String }
        },
        billingDetails: {
            name: { type: String },
            email: { type: String },
            phone: { type: String },
            address: {
                line1: { type: String },
                line2: { type: String },
                city: { type: String },
                state: { type: String },
                postalCode: { type: String },
                country: { type: String }
            }
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        metadata: {
            type: Object,
            default: {}
        }
    },
    { timestamps: true }
);

// Index for efficient queries
paymentMethodSchema.index({ user: 1, isActive: 1 });
paymentMethodSchema.index({ stripePaymentMethodId: 1 });
paymentMethodSchema.index({ user: 1, isDefault: 1 });

// Ensure only one default payment method per user
paymentMethodSchema.pre('save', async function (next) {
    if (this.isDefault && this.isActive) {
        // Remove default status from other payment methods for this user
        await this.constructor.updateMany(
            {
                user: this.user,
                _id: { $ne: this._id },
                isActive: true
            },
            { isDefault: false }
        );
    }
    next();
});

// Virtual for display name
paymentMethodSchema.virtual('displayName').get(function () {
    if (this.type === 'card') {
        return `${this.card.brand.charAt(0).toUpperCase() + this.card.brand.slice(1)} ending in ${this.card.last4}`;
    } else if (this.type === 'bank_account') {
        return `Bank Account ending in ${this.bankAccount.last4}`;
    }
    return 'Payment Method';
});

// Virtual for expiry display
paymentMethodSchema.virtual('expiryDisplay').get(function () {
    if (this.type === 'card' && this.card.expMonth && this.card.expYear) {
        return `${this.card.expMonth.toString().padStart(2, '0')}/${this.card.expYear.toString().slice(-2)}`;
    }
    return null;
});

// Method to get safe JSON representation
paymentMethodSchema.methods.toSafeJSON = function () {
    return {
        id: this._id,
        type: this.type,
        displayName: this.displayName,
        expiryDisplay: this.expiryDisplay,
        isDefault: this.isDefault,
        isActive: this.isActive,
        card: this.card,
        bankAccount: this.bankAccount,
        billingDetails: this.billingDetails,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Static method to get user's default payment method
paymentMethodSchema.statics.getDefaultForUser = async function (userId) {
    return await this.findOne({
        user: userId,
        isDefault: true,
        isActive: true
    });
};

// Static method to get all active payment methods for user
paymentMethodSchema.statics.getActiveForUser = async function (userId) {
    return await this.find({
        user: userId,
        isActive: true
    }).sort({ isDefault: -1, createdAt: -1 });
};

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
