const mongoose = require('mongoose');

const customerNoteSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    noteType: {
        type: String,
        enum: ['General', 'Billing', 'Technical', 'Account', 'Verification', 'Other'],
        default: 'General'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for faster queries
customerNoteSchema.index({ customerId: 1, deletedAt: 1 });
customerNoteSchema.index({ createdAt: -1 });
customerNoteSchema.index({ deletedAt: 1 });

// Method to convert to safe JSON
customerNoteSchema.methods.toSafeJSON = function () {
    return {
        id: this._id.toString(),
        customerId: this.customerId.toString(),
        noteType: this.noteType,
        priority: this.priority,
        content: this.content,
        tags: this.tags || [],
        createdBy: this.createdBy.toString(),
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
    };
};

const CustomerNote = mongoose.model('CustomerNote', customerNoteSchema);

module.exports = CustomerNote;

