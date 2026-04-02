const axios = require('axios');
const SystemSettings = require('../models/SystemSettings');

const WHOLESALER_API_URL = 'https://connecttel.oneview.net.au/api/v1/customer';

/**
 * Helper to get dynamic credentials from DB (Reused from otpProviderService pattern)
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

const wholesalerService = {
    /**
     * Create a customer in the wholesaler system (ConnectTel)
     * @param {Object} user - The local user object
     * @returns {Promise<string|null>} - The wholesaler customer ID or null if failed
     */
    createCustomer: async (user) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log(`[WHOLESALER] Creating customer for user: ${user.email}`);

            // Prepare billing address components
            let billingStreet = user.billingAddress || user.serviceAddress || '';
            let billingCity = 'Canberra';
            let billingState = 'Canberra';
            let billingPostCode = '2600';
            let billingCountry = 'au'; // Defaulting to au for clarity

            // If we have structured address information, use it
            if (user.addressInformation) {
                billingStreet = user.addressInformation.streetAddress || billingStreet;
                billingCity = user.addressInformation.city || '';
                billingState = user.addressInformation.state || '';
                billingPostCode = user.addressInformation.postcode || '';
                billingCountry = user.addressInformation.country || 'au';
            }

            // Fallback for required fields (using user's preferred "Canberra" fallbacks)
            if (!billingStreet) billingStreet = 'TBA';
            if (!billingCity) billingCity = 'Canberra';
            if (!billingState) billingState = 'Canberra';
            if (!billingPostCode) billingPostCode = '2600';
            if (!billingCountry) billingCountry = 'au';

            const payload = {
                name: `${user.firstName} ${user.lastName} ${new Date().getTime()}`,
                abn_acn: 1,
                status: 1, // 1 = Active
                account_manager: null,
                billing_rule_id: 1,
                invoice_system_id: 1,
                customer_pricelist: null,
                vpbx_default_music: 11,
                billing_first_name: user.firstName,
                billing_last_name: user.lastName,
                billing_email: user.email,
                billing_phone: user.phone || '03061234567',
                billing_website: null,
                // billing_street_address: billingStreet,
                billing_street_address: billingStreet.replaceAll(",", " "),
                billing_city: billingCity,
                billing_state: billingState,
                billing_country: 'au',
                billing_post_code: billingPostCode,
                site_name: `${user.firstName} ${user.lastName}`,
                notes: `Created via API Signup for ${user.email}`
            };

            console.log('CREATE CUSTOMER PAYLOAD:', payload);

            const response = await axios.post(WHOLESALER_API_URL, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('[WHOLESALER] Customer created successfully. Response:', response.data);

            const customerId = response.data?.data?.customer?.id || response.data?.id || response.data?.data?.customer_id;

            if (!customerId) {
                console.warn('[WHOLESALER] Warning: Customer ID not found in response', response.data);
                return { success: false, message: 'Customer created but ID not found in response', data: response.data };
            }

            return { success: true, customerId };

        } catch (error) {
            console.error('[WHOLESALER] Failed to create customer:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to create customer in wholesaler system'
            };
        }
    },

    /**
     * Submit an order for a new service to the wholesaler (ConnectTel)
     * @param {Object} user - The local user object
     * @param {number|string} customerId - The wholesaler customer ID
     * @param {Object} serviceDetails - Details about the service (plan, SIM, number)
     * @returns {Promise<Object>} - The API response
     */
    submitOrder: async (user, customerId, serviceDetails) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log(`[WHOLESALER] Submitting order for customer ${customerId}...`);

            const {
                esim, // boolean
                sim_number, // string (required if esim is false)
                plan_number, // string (wholesalerPlanId)
                selected_number, // string
                service_label, // optional
                esim_notification_email // string (optional)
            } = serviceDetails;

            const payload = {
                customer_id: parseInt(customerId, 10),
                esim: esim,
                sim_number: esim ? null : sim_number,
                plan_number: String(plan_number),
                service_label: service_label,
                notification_email: user.email,
                selected_number: selected_number,
                esim_notification_email: esim ? (esim_notification_email || user.email) : null,
                alternative_email_0: user.email, // Using user's email as default for alternatives
                alternative_email_1: user.email  // Using user's email as default for alternatives
            };

            console.log('SUBMIT ORDER PAYLOAD:', payload);

            const response = await axios.post(`${WHOLESALER_API_URL.replace('/customer', '')}/mobile/services/new`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('[WHOLESALER] Order submitted successfully. Response:', response.data);
            return { success: true, data: response.data };

        } catch (error) {
            console.error('[WHOLESALER] Failed to submit order:', error.response?.data || error.message);
            if (error.response?.data?.errors) {
                console.error('[WHOLESALER] Validation errors:', JSON.stringify(error.response.data.errors, null, 2));
            }
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to submit order to wholesaler'
            };
        }
    },

    /**
     * Fetch mobile rate plans from wholesaler
     * @returns {Promise<Object>} - The rate plans
     */
    getRatePlans: async () => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log('[WHOLESALER] Fetching mobile rate plans...');

            const response = await axios.get(`${WHOLESALER_API_URL.replace('/customer', '')}/mobile/rate-plans`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Accept': 'application/json'
                }
            });

            return { success: true, data: response.data?.data || response.data };

        } catch (error) {
            console.error('[WHOLESALER] Failed to fetch rate plans:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to fetch rate plans from wholesaler'
            };
        }
    },

    /**
     * Fetch NBN address autocomplete suggestions from wholesaler
     * @param {string} query - The address search query
     * @returns {Promise<Object>} - The address suggestions
     */
    getAddressAutocomplete: async (query) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log(`[WHOLESALER] Fetching NBN address autocomplete for query: ${query}...`);

            const response = await axios.get(`${WHOLESALER_API_URL.replace('/customer', '')}/nbn/address/autocomplete`, {
                params: { query },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Accept': 'application/json'
                }
            });

            return { success: true, data: response.data?.data || response.data };

        } catch (error) {
            console.error('[WHOLESALER] Failed to fetch NBN address suggestions:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to fetch NBN address suggestions from wholesaler'
            };
        }
    },

    /**
     * Search for a specific NBN address to get its locId
     * @param {string} query - The full address label
     * @returns {Promise<Object>} - The search result containing locId
     */
    searchNbnAddress: async (query) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log(`[WHOLESALER] Searching NBN address: ${query}...`);

            const response = await axios.post(`${WHOLESALER_API_URL.replace('/customer', '')}/nbn/address/search`, { query }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            return { success: true, data: response.data?.data || response.data };

        } catch (error) {
            console.error('[WHOLESALER] Failed to search NBN address:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to search NBN address'
            };
        }
    },

    /**
     * Perform Service Qualification (SQ) for a specific locId
     * @param {string} locId - The NBN Location ID
     * @returns {Promise<Object>} - The SQ results including bandwidths
     */
    getNbnServiceQualification: async (locId) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log(`[WHOLESALER] Performing SQ for locId: ${locId}...`);

            const response = await axios.get(`${WHOLESALER_API_URL.replace('/customer', '')}/nbn/sq/${locId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId,
                    'Accept': 'application/json'
                }
            });

            console.log('RESL ', response.data.data.bandwidths)

            return { success: true, data: response.data?.data || response.data };

        } catch (error) {
            console.error('[WHOLESALER] Failed to perform SQ:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to perform service qualification'
            };
        }
    },

    /**
     * Switch API Token Context to a Customer
     * @param {string|number} targetTenantId - The Customer ID to switch to
     */
    switchToTenant: async (targetTenantId) => {
        try {
            const { token, tenantId } = await getCredentials();
            if (!token) return { success: false };

            console.log(`[WHOLESALER] Switching API context to tenant ${targetTenantId}...`);
            const response = await axios.get(`${WHOLESALER_API_URL.replace('/customer', '')}/switch/to/${targetTenantId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId, // Master tenant
                    'Accept': 'application/json'
                }
            });
            console.log(`[WHOLESALER] Switch to tenant successful:`, response.data?.meta?.message);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('[WHOLESALER] Failed to switch tenant:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Switch API Token Context back to the Master Tenant
     * @param {string|number} currentTenantId - The Customer ID currently active
     */
    switchBack: async (currentTenantId) => {
        try {
            const { token } = await getCredentials();
            if (!token) return { success: false };

            console.log(`[WHOLESALER] Switching API context back from tenant ${currentTenantId}...`);
            const response = await axios.get(`${WHOLESALER_API_URL.replace('/customer', '')}/switch/back`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': currentTenantId, // Current active tenant
                    'Accept': 'application/json'
                }
            });
            console.log(`[WHOLESALER] Switch back successful:`, response.data?.meta?.message);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('[WHOLESALER] Failed to switch back:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Create a site for a customer (required for NBN orders)
     * @param {string|number} customerId - The wholesaler customer ID (used as tenant ID)
     * @param {Object} user - The local user object
     * @returns {Promise<number|null>} - The created site ID
     */
    createSite: async (customerId, user) => {
        try {
            const { token } = await getCredentials();

            if (!token) {
                console.error('[WHOLESALER] Missing token for createSite');
                return { success: false, message: 'Missing wholesaler token' };
            }

            console.log(`[WHOLESALER] Creating site for customer ${customerId}...`);

            // Extract address components (assuming addressInformation is available or using fallbacks)
            let unitNum = '';
            let streetNum = '';
            let streetName = '';
            let city = 'Canberra';
            let state = 'ACT';
            let postCode = '2600';
            let country = 'AU';

            if (user.addressInformation) {
                // Attempt to heuristically split street address into parts if possible, otherwise use whole string
                const streetParts = (user.addressInformation.streetAddress || user.serviceAddress || '').split(' ');
                if (streetParts.length > 0) {
                    streetNum = streetParts[0];
                    streetName = streetParts.slice(1).join(' ');
                }
                city = user.addressInformation.city || city;
                state = user.addressInformation.state || state;
                postCode = user.addressInformation.postcode || postCode;
                country = (user.addressInformation.country || country).toUpperCase();
            } else {
                // simple fallback if structure doesn't exist
                const parts = (user.serviceAddress || '').split(',');
                if (parts.length > 0) streetName = parts[0].trim();
            }

            const payload = {
                name: `${user.firstName} ${user.lastName}`,
                phone: user.phone || '0000000000',
                unit_number: unitNum,
                street_number: streetNum || '1', // default fallback
                street_name: streetName.replaceAll(",", " ") || 'Unknown Street', // default fallback
                post_code: parseInt(postCode, 10) || 2600,
                city: city,
                state: state,
                country: country
            };

            console.log(customerId, 'SITE CREATE PAYLOAD: ', payload)

            const response = await axios.post(`${WHOLESALER_API_URL}/sites`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': Number(customerId), // Use customer ID as tenant ID for this call
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const siteId = response.data?.data?.site?.id;
            if (!siteId) {
                return { success: false, message: 'Site created but ID not found in response', data: response.data };
            }

            console.log(customerId, '[WHOLESALER] Site created successfully:', siteId);
            return { success: true, siteId };

        } catch (error) {
            console.error(customerId, '[WHOLESALER] Failed to create site:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to create site in wholesaler system'
            };
        }
    },

    /**
     * Create a technical contact for a customer (required for NBN orders)
     * @param {string|number} customerId - The wholesaler customer ID (used as tenant ID)
     * @param {Object} user - The local user object
     * @returns {Promise<number|null>} - The created contact ID
     */
    createContact: async (customerId, user) => {
        try {
            const { token } = await getCredentials();

            if (!token) {
                console.error('[WHOLESALER] Missing token for createContact');
                return { success: false, message: 'Missing wholesaler token' };
            }

            console.log(`[WHOLESALER] Creating contact for customer ${customerId}...`);

            // Ensure we use the exact structure from the user
            const payload = {
                type: "18",
                description: "Main Tech Contact",
                first_name: user.firstName || 'Unknown',
                last_name: user.lastName || 'Unknown',
                email: user.email,
                mobile: user.phone || '0000000000'
            };

            console.log('CONTACT CREATE PAYLOAD: ', payload)

            const response = await axios.post(`${WHOLESALER_API_URL}/contacts`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': Number(customerId), // Use customer ID as tenant ID for this call
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const contactId = response.data?.data?.contact?.id;
            if (!contactId) {
                return { success: false, message: 'Contact created but ID not found in response', data: response.data };
            }

            console.log('[WHOLESALER] Contact created successfully:', contactId);
            return { success: true, contactId };

        } catch (error) {
            console.error('[WHOLESALER] Failed to create contact:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to create contact in wholesaler system'
            };
        }
    },

    /**
     * Submit an NBN order to the wholesaler (ConnectTel)
     * @param {Object} payload - The order details
     * @returns {Promise<Object>} - The API response
     */
    submitNbnOrder: async (payload) => {
        try {
            const { token, tenantId } = await getCredentials();

            if (!token || !tenantId) {
                console.error('[WHOLESALER] Missing credentials (token/tenantId)');
                return { success: false, message: 'Missing wholesaler credentials' };
            }

            console.log(`[WHOLESALER] Submitting NBN order for customer ${payload.customer_id}...`);

            const orderPayload = {
                loc_id: payload.loc_id,
                customer_id: parseInt(payload.customer_id, 10),
                site_id: parseInt(payload.site_id, 10),
                contact_id: parseInt(payload.contact_id, 10),
                fiber_uplift: false,
                bandwidth_id: `id_${payload.bandwidth_id}`,
                sla: 14,
                static_ip: !!payload.static_ip,
                ipv6_disabled: false,
                contact_phone_type: "mobile",
                service_ref: payload.service_ref || `AVC889585262716`, // Use extracted AVC for churns, fallback to placeholder
                line: payload.line || "NEW",
                port: payload.port || ""
            };

            console.log('[WHOLESALER] NBN ORDER PAYLOAD: ', orderPayload)

            const response = await axios.post(`${WHOLESALER_API_URL.replace('/customer', '')}/nbn/orders`, orderPayload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Id': tenantId, // Master tenant ID
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('[WHOLESALER] NBN Order submitted successfully. Response:', response.data);
            return { success: true, data: response.data };

        } catch (error) {
            console.error('[WHOLESALER] Failed to submit NBN order:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to submit NBN order to wholesaler'
            };
        }
    }
};

module.exports = wholesalerService;