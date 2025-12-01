const SystemSettings = require('../models/SystemSettings');
const axios = require('axios');

class SystemSettingsService {
    // Get system settings (creates default if doesn't exist)
    async getSettings() {
        try {
            let settings = await SystemSettings.findOne({ settingsKey: 'system' });

            if (!settings) {
                // Create default settings
                settings = await SystemSettings.create({ settingsKey: 'system' });
            }

            return settings.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to fetch system settings: ${error.message}`);
        }
    }

    // Update integrations settings
    async updateIntegrations(data) {
        try {
            const { oneview, zoho } = data;

            // Get existing settings to preserve API keys if not provided
            let existingSettings = await SystemSettings.findOne({ settingsKey: 'system' });

            const updateData = {};

            // Handle Oneview integration
            if (oneview) {
                const oneviewUpdate = {
                    apiEndpoint: oneview.apiEndpoint || (existingSettings?.integrations?.oneview?.apiEndpoint || 'https://api.oneview.com.au/v1'),
                    enabled: oneview.enabled !== undefined ? oneview.enabled : (existingSettings?.integrations?.oneview?.enabled || false)
                };
                // Only update API key if provided
                if (oneview.apiKey !== undefined && oneview.apiKey !== '') {
                    oneviewUpdate.apiKey = oneview.apiKey;
                } else if (existingSettings?.integrations?.oneview?.apiKey) {
                    oneviewUpdate.apiKey = existingSettings.integrations.oneview.apiKey;
                } else {
                    oneviewUpdate.apiKey = '';
                }
                updateData['integrations.oneview'] = oneviewUpdate;
            }

            // Handle Zoho integration
            if (zoho) {
                const zohoUpdate = {
                    clientId: zoho.clientId || (existingSettings?.integrations?.zoho?.clientId || ''),
                    syncEnabled: zoho.syncEnabled !== undefined ? zoho.syncEnabled : (existingSettings?.integrations?.zoho?.syncEnabled || false)
                };
                // Only update API key if provided
                if (zoho.apiKey !== undefined && zoho.apiKey !== '') {
                    zohoUpdate.apiKey = zoho.apiKey;
                } else if (existingSettings?.integrations?.zoho?.apiKey) {
                    zohoUpdate.apiKey = existingSettings.integrations.zoho.apiKey;
                } else {
                    zohoUpdate.apiKey = '';
                }
                updateData['integrations.zoho'] = zohoUpdate;
            }

            const settings = await SystemSettings.findOneAndUpdate(
                { settingsKey: 'system' },
                { $set: updateData },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return settings.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update integrations: ${error.message}`);
        }
    }

    // Update notifications settings
    async updateNotifications(data) {
        try {
            const { email, sms } = data;

            const settings = await SystemSettings.findOneAndUpdate(
                { settingsKey: 'system' },
                {
                    $set: {
                        'notifications.email': email || {},
                        'notifications.sms': sms || {}
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return settings.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update notifications: ${error.message}`);
        }
    }

    // Update security settings
    async updateSecurity(data) {
        try {
            const settings = await SystemSettings.findOneAndUpdate(
                { settingsKey: 'system' },
                {
                    $set: {
                        security: data
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return settings.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update security settings: ${error.message}`);
        }
    }

    // Update system settings
    async updateSystem(data) {
        try {
            const settings = await SystemSettings.findOneAndUpdate(
                { settingsKey: 'system' },
                {
                    $set: {
                        system: data
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return settings.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update system settings: ${error.message}`);
        }
    }

    // Test Oneview connection
    async testOneviewConnection(apiEndpoint, apiKey) {
        try {
            // If no API key provided, try to get from saved settings
            let keyToUse = apiKey;
            if (!keyToUse) {
                const settings = await SystemSettings.findOne({ settingsKey: 'system' });
                if (settings && settings.integrations?.oneview?.apiKey) {
                    keyToUse = settings.integrations.oneview.apiKey;
                }
            }

            if (!keyToUse) {
                return {
                    success: false,
                    message: 'API key is required to test connection'
                };
            }

            // This is a placeholder - implement actual API test
            // You would make an HTTP request to the Oneview API here
            const response = await axios.get(`${apiEndpoint}/health`, {
                headers: {
                    'Authorization': `Bearer ${keyToUse}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            return {
                success: response.status === 200,
                message: response.status === 200 ? 'Connection successful' : 'Connection failed'
            };
        } catch (error) {
            return {
                success: false,
                message: error.response
                    ? `Connection failed: ${error.response.status} ${error.response.statusText}`
                    : `Connection error: ${error.message}`
            };
        }
    }
}

module.exports = new SystemSettingsService();

