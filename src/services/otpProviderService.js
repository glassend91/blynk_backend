const axios = require('axios');
const SystemSettings = require('../models/SystemSettings');

// External provider API details
const EXTERNAL_OTP_API_URL = 'https://connecttel.oneview.net.au/api/v1/mobile/send-otp';
const VERIFY_OTP_API_URL = 'https://connecttel.oneview.net.au/api/v1/mobile/verify-otp';

/**
 * Helper to get dynamic credentials from DB
 */
async function getCredentials() {
    try {
        const settings = await SystemSettings.findOne({ settingsKey: 'system' });
        if (settings && settings.integrations?.connectTel) {
            const { token, tenantId } = settings.integrations.connectTel;
            if (token && tenantId) {
                return { token, tenantId };
            }
        }
    } catch (err) {
        console.error('Error fetching ConnectTel credentials from DB:', err);
    }

    // Fallback to env variables
    return {
        token: process.env.OTP_PROVIDER_TOKEN,
        tenantId: process.env.OTP_PROVIDER_TENANT_ID
    };
}

/**
 * Service to handle external SMS OTP delivery via ConnectTel
 */
const otpProviderService = {
    /**
     * Send OTP via SMS using ConnectTel API
     * @param {string} phoneNumber - Recipient phone number
     * @returns {Promise<Object>} - API response
     */
    sendSMSOTP: async (phoneNumber) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[OTP PROVIDER] Missing credentials (token/tenantId) for ConnectTel');
                return {
                    success: false,
                    message: 'OTP provider credentials (token/tenantId) not configured'
                };
            }

            console.log(`[OTP PROVIDER] Sending SMS to ${phoneNumber} via ConnectTel...`);

            const response = await axios.post(EXTERNAL_OTP_API_URL, {
                number: phoneNumber
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            console.log('[OTP PROVIDER] External API Responded:', response.data);
            // Expected response data: { success: true, transactionId: "..." }
            return { success: true, data: response.data };
        } catch (error) {
            console.error('[OTP PROVIDER] External API Error (Send):', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to send SMS OTP via provider'
            };
        }
    },

    /**
     * Verify OTP via ConnectTel API
     * @param {string} transactionId - The transaction ID from send-otp response
     * @param {string} otp - The OTP code provided by the user
     * @returns {Promise<Object>} - API response
     */
    verifySMSOTP: async (transactionId, otp) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[OTP PROVIDER] Missing credentials (token/tenantId) for ConnectTel');
                return {
                    success: false,
                    message: 'OTP provider credentials (token/tenantId) not configured'
                };
            }

            console.log(`[OTP PROVIDER] Verifying OTP for Transaction: ${transactionId}...`);

            const response = await axios.post(VERIFY_OTP_API_URL, {
                transactionId,
                otp
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            console.log('[OTP PROVIDER] Verification API Responded:', response.data);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('[OTP PROVIDER] External API Error (Verify):', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to verify SMS OTP via provider'
            };
        }
    }
};

module.exports = otpProviderService;
