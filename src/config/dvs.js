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
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport',
            'Medical Card': 'medicare_card'
        }
    },

    // IDScan.net Configuration
    idscan: {
        apiKey: process.env.IDSCAN_API_KEY,
        baseUrl: 'https://api.idscan.net',
        endpoint: '/v1/verify',
        supportedDocuments: {
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport',
            'Medical Card': 'medicare_card'
        }
    },

    // Veryfi Configuration
    veryfi: {
        clientId: process.env.VERYFI_CLIENT_ID,
        clientSecret: process.env.VERYFI_CLIENT_SECRET,
        baseUrl: 'https://api.veryfi.com',
        endpoint: '/api/v8/documents',
        supportedDocuments: {
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport'
        }
    },

    // Azure Document Intelligence Configuration
    azure: {
        endpoint: process.env.AZURE_DOCUMENT_ENDPOINT,
        apiKey: process.env.AZURE_DOCUMENT_API_KEY,
        modelId: process.env.AZURE_DOCUMENT_MODEL_ID || 'prebuilt-idDocument',
        supportedDocuments: {
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport'
        }
    },

    // Mock Provider for Testing
    mock: {
        supportedDocuments: {
            'Driver\'s Licence': 'drivers_license',
            'Passport': 'passport',
            'Medical Card': 'medicare_card'
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