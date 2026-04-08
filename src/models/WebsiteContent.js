const mongoose = require('mongoose');

const heroBlockSchema = new mongoose.Schema({
    headline: {
        type: String,
        required: true,
        trim: true
    },
    subtitle: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const featuresBlockSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    subtitle: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const seoBlockSchema = new mongoose.Schema({
    metaTitle: {
        type: String,
        required: true,
        trim: true
    },
    metaDescription: {
        type: String,
        trim: true,
        default: ''
    },
    keywords: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const websiteContentSchema = new mongoose.Schema({
    pageKey: {
        type: String,
        required: true,
        unique: true,
        enum: ['home', 'about', 'service', 'hardship', 'policies', 'help', 'seo'],
        trim: true
    },
    hero: {
        type: heroBlockSchema,
        required: false
    },
    features: {
        type: featuresBlockSchema,
        required: false
    },
    bodyContent: {
        type: String,
        trim: true,
        default: ''
    },
    pageTitle: {
        type: String,
        trim: true,
        default: ''
    },
    seo: {
        type: seoBlockSchema,
        required: true
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index for faster queries
websiteContentSchema.index({ pageKey: 1 });
websiteContentSchema.index({ deletedAt: 1 });

// Method to convert to safe JSON
websiteContentSchema.methods.toSafeJSON = function () {
    return {
        id: this._id,
        pageKey: this.pageKey,
        hero: this.hero,
        features: this.features,
        bodyContent: this.bodyContent || '',
        pageTitle: this.pageTitle || '',
        seo: this.seo,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

const WebsiteContent = mongoose.model('WebsiteContent', websiteContentSchema);

module.exports = WebsiteContent;

