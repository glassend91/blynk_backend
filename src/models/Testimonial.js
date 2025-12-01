const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    plan: {
        type: String,
        trim: true,
        default: ''
    },
    rating: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5],
        default: 5
    },
    avatarUrl: {
        type: String,
        trim: true,
        default: ''
    },
    quote: {
        type: String,
        required: true,
        trim: true
    },
    published: {
        type: Boolean,
        default: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for faster queries
testimonialSchema.index({ name: 1 });
testimonialSchema.index({ published: 1 });
testimonialSchema.index({ createdAt: -1 });
testimonialSchema.index({ deletedAt: 1 });

// Method to convert to safe JSON
testimonialSchema.methods.toSafeJSON = function() {
    return {
        id: this._id.toString(),
        name: this.name,
        location: this.location,
        plan: this.plan || undefined,
        rating: this.rating,
        avatarUrl: this.avatarUrl || undefined,
        quote: this.quote,
        published: this.published,
        createdAt: this.createdAt.toISOString()
    };
};

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

module.exports = Testimonial;

