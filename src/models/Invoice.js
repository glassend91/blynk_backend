const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    billingPeriod: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    tax: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'AUD'
    },
    lineItems: [{
        description: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Service'
        },
        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription'
        }
    }],
    paymentMethod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentMethod'
    },
    paymentDate: {
        type: Date
    },
    paymentReference: {
        type: String
    },
    notes: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Index for efficient queries
invoiceSchema.index({ customerId: 1, status: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ invoiceNumber: 1 });

// Virtual for formatted invoice number
invoiceSchema.virtual('formattedInvoiceNumber').get(function () {
    return `INV-${this.invoiceNumber}`;
});

// Method to calculate totals
invoiceSchema.methods.calculateTotals = function () {
    this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
    this.total = this.subtotal - this.discount + this.tax;
    return this;
};

// Method to check if invoice is overdue
invoiceSchema.methods.isOverdue = function () {
    return this.status !== 'paid' && this.dueDate < new Date();
};

// Static method to generate next invoice number
invoiceSchema.statics.generateInvoiceNumber = async function () {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}`;

    const lastInvoice = await this.findOne({
        invoiceNumber: { $regex: `^${prefix}` }
    }).sort({ invoiceNumber: -1 });

    if (!lastInvoice) {
        return `${prefix}-001`;
    }

    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
    return `${prefix}-${nextNumber}`;
};

module.exports = mongoose.model('Invoice', invoiceSchema);
