const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    roleTitle: {
        type: String,
        trim: true,
        default: ''
    },
    years: {
        type: String,
        trim: true,
        default: ''
    },
    specialties: {
        type: String,
        trim: true,
        default: ''
    },
    videoUrl: {
        type: String,
        trim: true,
        default: ''
    },
    bio: {
        type: String,
        trim: true,
        default: ''
    },
    photoUrl: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: true });

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    hours: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    googleLink: {
        type: String,
        trim: true,
        default: ''
    },
    bannerUrl: {
        type: String,
        trim: true,
        default: ''
    },
    pitch: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    technicians: [technicianSchema],
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
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
storeSchema.index({ name: 1 });
storeSchema.index({ status: 1 });
storeSchema.index({ createdAt: -1 });
storeSchema.index({ deletedAt: 1 });

// Method to convert to safe JSON
storeSchema.methods.toSafeJSON = function() {
    return {
        id: this._id.toString(),
        name: this.name,
        address: this.address,
        hours: this.hours,
        phone: this.phone,
        lat: this.lat,
        lng: this.lng,
        googleLink: this.googleLink || undefined,
        bannerUrl: this.bannerUrl || undefined,
        pitch: this.pitch || undefined,
        status: this.status,
        technicians: this.technicians.map(t => ({
            id: t._id.toString(),
            fullName: t.fullName,
            roleTitle: t.roleTitle || undefined,
            years: t.years || undefined,
            specialties: t.specialties || undefined,
            videoUrl: t.videoUrl || undefined,
            bio: t.bio || undefined,
            photoUrl: t.photoUrl || undefined
        })),
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString()
    };
};

const Store = mongoose.model('Store', storeSchema);

module.exports = Store;

