const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/system-settings
 * @desc    Get all system settings
 * @access  Private (Admin)
 */
router.get('/', systemSettingsController.getSettings);

/**
 * @route   PUT /api/system-settings/integrations
 * @desc    Update integrations settings
 * @access  Private (Admin)
 * @body    { oneview: { apiEndpoint, apiKey, enabled }, zoho: { clientId, apiKey, syncEnabled } }
 */
router.put('/integrations', systemSettingsController.updateIntegrations);

/**
 * @route   PUT /api/system-settings/notifications
 * @desc    Update notification settings
 * @access  Private (Admin)
 * @body    { email: { newTickets, newUsers, systemAlerts }, sms: { criticalAlerts, serviceOutages } }
 */
router.put('/notifications', systemSettingsController.updateNotifications);

/**
 * @route   PUT /api/system-settings/security
 * @desc    Update security settings
 * @access  Private (Admin)
 * @body    { require2FA, passwordExpiry, passwordExpiryDays, sessionTimeout }
 */
router.put('/security', systemSettingsController.updateSecurity);

/**
 * @route   PUT /api/system-settings/system
 * @desc    Update system configuration
 * @access  Private (Admin)
 * @body    { companyName, supportEmail, oneviewEnabled }
 */
router.put('/system', systemSettingsController.updateSystem);

/**
 * @route   POST /api/system-settings/integrations/oneview/test
 * @desc    Test Oneview API connection
 * @access  Private (Admin)
 * @body    { apiEndpoint, apiKey }
 */
router.post('/integrations/oneview/test', systemSettingsController.testOneviewConnection);

module.exports = router;

