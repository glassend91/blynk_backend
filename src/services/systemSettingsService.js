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

    // Update ConnectTel integration settings
    async updateConnectTel(data) {
        try {
            const { email, password, tenantId, enabled } = data;

            const updateData = {};
            if (email !== undefined) updateData['integrations.connectTel.email'] = email;
            if (tenantId !== undefined) updateData['integrations.connectTel.tenantId'] = tenantId;
            if (enabled !== undefined) updateData['integrations.connectTel.enabled'] = enabled;
            if (password) updateData['integrations.connectTel.password'] = password;

            if (Object.keys(updateData).length === 0) {
                return this.getSettings();
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
            throw new Error(`Failed to update ConnectTel settings: ${error.message}`);
        }
    }

    // Login to ConnectTel and save token
    async loginToConnectTel(credentials = {}) {
        try {
            const { email: bodyEmail, password: bodyPassword, tenantId: bodyTenantId } = credentials;

            // If credentials are provided in the body, save them first
            if (bodyEmail || bodyPassword || bodyTenantId) {
                const updateData = {};
                if (bodyEmail) updateData['integrations.connectTel.email'] = bodyEmail;
                if (bodyPassword) updateData['integrations.connectTel.password'] = bodyPassword;
                if (bodyTenantId) updateData['integrations.connectTel.tenantId'] = bodyTenantId;

                await SystemSettings.updateOne(
                    { settingsKey: 'system' },
                    { $set: updateData },
                    { upsert: true }
                );
            }

            const settingsDoc = await SystemSettings.findOne({ settingsKey: 'system' });
            if (!settingsDoc || !settingsDoc.integrations?.connectTel) {
                throw new Error('ConnectTel settings not found');
            }

            const { email, password, tenantId } = settingsDoc.integrations.connectTel;

            if (!email || !password || !tenantId) {
                throw new Error('Email, password, and tenant ID are required for ConnectTel login');
            }

            const response = await axios.post('https://connecttel.oneview.net.au/api/v1/login', {
                email,
                password
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId
                }
            });

            if (response.data?.data?.token) {
                const token = response.data.data.token;

                const tokenUpdatedAt = new Date();
                await SystemSettings.updateOne(
                    { settingsKey: 'system' },
                    {
                        $set: {
                            'integrations.connectTel.token': token,
                            'integrations.connectTel.tokenUpdatedAt': tokenUpdatedAt
                        }
                    }
                );

                return {
                    success: true,
                    message: 'Authenticated successfully',
                    token,
                    tokenUpdatedAt
                };
            } else {
                throw new Error('No token received from ConnectTel');
            }
        } catch (error) {
            const message = error.response?.data?.meta?.message || error.message;
            throw new Error(`ConnectTel login failed: ${message}`);
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

