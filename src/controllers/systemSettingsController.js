const systemSettingsService = require('../services/systemSettingsService');

class SystemSettingsController {
    // Get all system settings
    async getSettings(req, res) {
        try {
            const settings = await systemSettingsService.getSettings();
            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update integrations settings
    async updateIntegrations(req, res) {
        try {
            const { oneview, zoho } = req.body;

            const settings = await systemSettingsService.updateIntegrations({
                oneview,
                zoho
            });

            res.status(200).json({
                success: true,
                message: 'Integrations settings updated successfully',
                data: settings
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update notifications settings
    async updateNotifications(req, res) {
        try {
            const { email, sms } = req.body;

            const settings = await systemSettingsService.updateNotifications({
                email,
                sms
            });

            res.status(200).json({
                success: true,
                message: 'Notification settings updated successfully',
                data: settings
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update security settings
    async updateSecurity(req, res) {
        try {
            const settings = await systemSettingsService.updateSecurity(req.body);

            res.status(200).json({
                success: true,
                message: 'Security settings updated successfully',
                data: settings
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update system settings
    async updateSystem(req, res) {
        try {
            const settings = await systemSettingsService.updateSystem(req.body);

            res.status(200).json({
                success: true,
                message: 'System settings updated successfully',
                data: settings
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update ConnectTel integration settings
    async updateConnectTel(req, res) {
        try {
            const settings = await systemSettingsService.updateConnectTel(req.body);

            res.status(200).json({
                success: true,
                message: 'ConnectTel settings updated successfully',
                data: settings
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Login to ConnectTel and save token
    async loginToConnectTel(req, res) {
        try {
            const result = await systemSettingsService.loginToConnectTel(req.body);

            res.status(200).json({
                success: true,
                message: result.message,
                token: result.token,
                tokenUpdatedAt: result.tokenUpdatedAt
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Test Oneview connection
    async testOneviewConnection(req, res) {
        try {
            const { apiEndpoint, apiKey } = req.body;

            if (!apiEndpoint || !apiKey) {
                return res.status(400).json({
                    success: false,
                    message: 'API endpoint and API key are required'
                });
            }

            const result = await systemSettingsService.testOneviewConnection(apiEndpoint, apiKey);

            res.status(200).json({
                success: result.success,
                message: result.message
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new SystemSettingsController();

