// DVS (Document Verification Service) Configuration
const dvsConfig = {
    // Primary DVS Provider Configuration
    provider: process.env.DVS_PROVIDER || 'idanalyzer', // 'idanalyzer', 'idscan', 'veryfi', 'azure', 'mock'

    // ID Analyzer Configuration
    idanalyzer: {
        apiKey: process.env.IDANALYZER_API_KEY,
        baseUrl: 'https://api.idanalyzer.com',
        endpoint: '',
        // Document types supported
        supportedDocuments: {
            'Driver Licence': 'drivers_license',
            'Driver\'s Licence': 'drivers_license',
            'Medicare Card': 'medicare_card',
            'Medical Card': 'medicare_card',
            'Passport': 'passport',
            'Visa': 'passport', // Visa uses passport document
            'ImmiCard': 'id_card',
            'Birth Certificate': 'birth_certificate'
        }
    },

    // IDScan.net Configuration
    idscan: {
        apiKey: process.env.IDSCAN_API_KEY,
        baseUrl: 'https://api.idscan.net',
        endpoint: '/v1/verify',
        supportedDocuments: {
            'Driver Licence': 'drivers_license',
            'Driver\'s Licence': 'drivers_license',
            'Medicare Card': 'medicare_card',
            'Medical Card': 'medicare_card',
            'Passport': 'passport',
            'Visa': 'passport',
            'ImmiCard': 'id_card',
            'Birth Certificate': 'birth_certificate'
        }
    },

    // Veryfi Configuration
    veryfi: {
        clientId: process.env.VERYFI_CLIENT_ID,
        clientSecret: process.env.VERYFI_CLIENT_SECRET,
        baseUrl: 'https://api.veryfi.com',
        endpoint: '/api/v8/documents',
        supportedDocuments: {
            'Driver Licence': 'drivers_license',
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport',
            'Visa': 'passport'
        }
    },

    // Azure Document Intelligence Configuration
    azure: {
        endpoint: process.env.AZURE_DOCUMENT_ENDPOINT,
        apiKey: process.env.AZURE_DOCUMENT_API_KEY,
        modelId: process.env.AZURE_DOCUMENT_MODEL_ID || 'prebuilt-idDocument',
        supportedDocuments: {
            'Driver Licence': 'drivers_license',
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport',
            'Visa': 'passport'
        }
    },

    // Mock Provider for Testing
    mock: {
        supportedDocuments: {
            'Driver Licence': 'drivers_license',
            'Driver\'s Licence': 'drivers_license',
            'Medicare Card': 'medicare_card',
            'Medical Card': 'medicare_card',
            'Passport': 'passport',
            'Visa': 'passport',
            'ImmiCard': 'id_card',
            'Birth Certificate': 'birth_certificate'
        }
    },

    // Common settings
    settings: {
        // Verification timeout in milliseconds
        timeout: 30000,
        // Maximum file size in bytes (5MB)
        maxFileSize: 5 * 1024 * 1024,
        // Allowed image formats
        allowedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
        // Verification retry attempts
        maxRetries: 3,
        // Cache verification results for this duration (in minutes)
        cacheDuration: 60
    }
};

module.exports = dvsConfig;