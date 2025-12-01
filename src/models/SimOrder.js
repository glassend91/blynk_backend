const mongoose = require('mongoose');

const simOrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    customer: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    plan: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['Pending ICCID', 'Awaiting Provisioning', 'Provisioned'],
        default: 'Pending ICCID'
    },
    orderDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    iccid: {
        type: String,
        trim: true,
        default: ''
    },
    provisioningNotes: {
        type: String,
        trim: true,
        default: ''
    },
    provisionedAt: {
        type: Date,
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
simOrderSchema.index({ orderNumber: 1 });
simOrderSchema.index({ status: 1 });
simOrderSchema.index({ orderDate: -1 });
simOrderSchema.index({ deletedAt: 1 });
simOrderSchema.index({ email: 1 });

// Method to convert to safe JSON
simOrderSchema.methods.toSafeJSON = function () {
    return {
        id: this._id.toString(),
        orderNumber: this.orderNumber,
        customer: this.customer,
        email: this.email,
        plan: this.plan,
        status: this.status,
        orderDate: this.orderDate.toISOString().split('T')[0],
        iccid: this.iccid || undefined,
        provisioningNotes: this.provisioningNotes || undefined,
        provisionedAt: this.provisionedAt ? this.provisionedAt.toISOString() : undefined,
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
    };
};

const SimOrder = mongoose.model('SimOrder', simOrderSchema);

module.exports = SimOrder;

