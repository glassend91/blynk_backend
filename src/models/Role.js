const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, required: true },
        description: { type: String, trim: true, default: '' },
        usersCount: { type: Number, default: 0 },
        badge: {
            type: String,
            enum: ['Default', 'Medium'],
            default: undefined
        },
        // Simple object map of permissionKey -> boolean
        permissions: {
            type: Object,
            default: {}
        },
        monthlyCreditLimit: { type: Number, default: 0 }
    },
    { timestamps: true }
);

roleSchema.methods.toSafeJSON = function () {
    return {
        id: this._id.toString(),
        name: this.name,
        description: this.description,
        usersCount: this.usersCount,
        badge: this.badge,
        permissions: this.permissions || {},
        monthlyCreditLimit: this.monthlyCreditLimit || 0,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

module.exports = mongoose.model('Role', roleSchema);



