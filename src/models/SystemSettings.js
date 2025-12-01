const mongoose = require('mongoose');

// Integrations Schema
const oneviewIntegrationSchema = new mongoose.Schema({
    apiEndpoint: {
        type: String,
        default: 'https://api.oneview.com.au/v1',
        trim: true
    },
    apiKey: {
        type: String,
        default: '',
        trim: true
    },
    enabled: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const zohoIntegrationSchema = new mongoose.Schema({
    clientId: {
        type: String,
        default: '',
        trim: true
    },
    apiKey: {
        type: String,
        default: '',
        trim: true
    },
    syncEnabled: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Notifications Schema
const emailNotificationsSchema = new mongoose.Schema({
    newTickets: {
        type: Boolean,
        default: true
    },
    newUsers: {
        type: Boolean,
        default: true
    },
    systemAlerts: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const smsNotificationsSchema = new mongoose.Schema({
    criticalAlerts: {
        type: Boolean,
        default: true
    },
    serviceOutages: {
        type: Boolean,
        default: true
    }
}, { _id: false });

// Security Schema
const securitySettingsSchema = new mongoose.Schema({
    require2FA: {
        type: Boolean,
        default: false
    },
    passwordExpiry: {
        type: Boolean,
        default: false
    },
    passwordExpiryDays: {
        type: Number,
        default: 90,
        min: 1,
        max: 365
    },
    sessionTimeout: {
        type: Number,
        default: 60,
        min: 1,
        max: 1440
    }
}, { _id: false });

// System Schema
const systemConfigSchema = new mongoose.Schema({
    companyName: {
        type: String,
        default: 'Your Telecommunications Provider',
        trim: true
    },
    supportEmail: {
        type: String,
        default: 'support@yourtelco.com.au',
        trim: true
    },
    oneviewEnabled: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const systemSettingsSchema = new mongoose.Schema({
    // Single document pattern - only one settings document exists
    settingsKey: {
        type: String,
        default: 'system',
        unique: true,
        immutable: true
    },
    integrations: {
        oneview: {
            type: oneviewIntegrationSchema,
            default: () => ({})
        },
        zoho: {
            type: zohoIntegrationSchema,
            default: () => ({})
        }
    },
    notifications: {
        email: {
            type: emailNotificationsSchema,
            default: () => ({})
        },
        sms: {
            type: smsNotificationsSchema,
            default: () => ({})
        }
    },
    security: {
        type: securitySettingsSchema,
        default: () => ({})
    },
    system: {
        type: systemConfigSchema,
        default: () => ({})
    }
}, {
    timestamps: true
});

// Index for faster queries
systemSettingsSchema.index({ settingsKey: 1 });

// Method to convert to safe JSON
systemSettingsSchema.methods.toSafeJSON = function () {
    return {
        id: this._id,
        integrations: this.integrations,
        notifications: this.notifications,
        security: this.security,
        system: this.system,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;

