const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    isFromAdmin: {
        type: Boolean,
        default: false
    },
    attachments: [{
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        url: String
    }]
}, { timestamps: true });

const supportTicketSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['Technical', 'Billing', 'Account', 'Service', 'General'],
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'],
        default: 'Open'
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    messages: [messageSchema],
    tags: [{
        type: String,
        trim: true
    }],
    // Tracking fields
    firstResponseTime: {
        type: Date,
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    closedAt: {
        type: Date,
        default: null
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    // Additional metadata
    source: {
        type: String,
        enum: ['Web', 'Email', 'Phone', 'Chat', 'API'],
        default: 'Web'
    },
    escalationLevel: {
        type: Number,
        default: 1,
        min: 1,
        max: 3
    },
    satisfactionRating: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        feedback: String,
        ratedAt: Date
    }
}, {
    timestamps: true
});


// Method to update last activity
supportTicketSchema.methods.updateLastActivity = function () {
    this.lastActivity = new Date.now();
    return this.save();
};

// Method to add a message
supportTicketSchema.methods.addMessage = function (senderId, content, isFromAdmin = false, attachments = []) {
    this.messages.push({
        sender: senderId,
        content,
        isFromAdmin,
        attachments
    });

    // Update first response time if this is the first admin response
    if (isFromAdmin && !this.firstResponseTime) {
        this.firstResponseTime = new Date();
    }

    this.lastActivity = new Date();
    return this.save();
};

// Method to calculate response time
supportTicketSchema.methods.getResponseTime = function () {
    if (!this.firstResponseTime) return null;
    return this.firstResponseTime - this.createdAt;
};

// Method to get safe JSON representation
supportTicketSchema.methods.toSafeJSON = function () {
    return {
        id: this._id,
        subject: this.subject,
        description: this.description,
        category: this.category,
        priority: this.priority,
        status: this.status,
        customer: this.customer,
        assignedTo: this.assignedTo,
        messages: this.messages,
        tags: this.tags,
        firstResponseTime: this.firstResponseTime,
        resolvedAt: this.resolvedAt,
        closedAt: this.closedAt,
        lastActivity: this.lastActivity,
        source: this.source,
        escalationLevel: this.escalationLevel,
        satisfactionRating: this.satisfactionRating,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// Static method to get ticket statistics
supportTicketSchema.statics.getStatistics = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalTickets: { $sum: 1 },
                openTickets: {
                    $sum: {
                        $cond: [{ $in: ['$status', ['Open', 'In Progress']] }, 1, 0]
                    }
                },
                resolvedTickets: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
                    }
                },
                avgResponseTime: {
                    $avg: {
                        $cond: [
                            { $ne: ['$firstResponseTime', null] },
                            { $subtract: ['$firstResponseTime', '$createdAt'] },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    return stats[0] || {
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0,
        avgResponseTime: null
    };
};

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
