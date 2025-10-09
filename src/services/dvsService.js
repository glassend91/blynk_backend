const axios = require('axios');
const FormData = require('form-data');
const dvsConfig = require('../config/dvs');

class DVSService {
    constructor() {
        this.config = dvsConfig;
        this.provider = dvsConfig.provider;
        this.providerConfig = dvsConfig[this.provider];
    }

    /**
     * Verify identity document using the configured DVS provider
     * @param {Object} documentData - Document verification data
     * @param {string} documentData.idType - Type of document (Driver's Licence, Passport, Medical Card)
     * @param {string} documentData.firstName - First name on document
     * @param {string} documentData.lastName - Last name on document
     * @param {string} documentData.dateOfBirth - Date of birth (DD/MM/YYYY)
     * @param {string} documentData.documentNumber - Document number
     * @param {string} documentData.additionalData - Additional document-specific data
     * @param {Buffer|File} documentData.documentImage - Document image file
     * @returns {Promise<Object>} Verification result
     */
    async verifyDocument(documentData) {
        try {
            // Validate document data
            this.validateDocumentData(documentData);

            // Check if provider supports this document type
            // if (!this.isDocumentTypeSupported(documentData.idType)) {
            //     throw new Error(`Document type '${documentData.idType}' is not supported by ${this.provider}`);
            // }

            // Route to appropriate provider method
            switch (this.provider) {
                case 'idanalyzer':
                    return await this.verifyWithIDAnalyzer(documentData);
                case 'idscan':
                    return await this.verifyWithIDScan(documentData);
                case 'veryfi':
                    return await this.verifyWithVeryfi(documentData);
                case 'azure':
                    return await this.verifyWithAzure(documentData);
                case 'mock':
                    return await this.verifyWithMock(documentData);
                default:
                    throw new Error(`Unsupported DVS provider: ${this.provider}`);
            }
        } catch (error) {
            console.error('DVS Verification Error:', error.message);
            throw new Error(`Document verification failed: ${error.message}`);
        }
    }

    /**
     * Verify document using ID Analyzer
     */
    async verifyWithIDAnalyzer(documentData) {
        const formData = new FormData();

        // Add document image
        formData.append('file', documentData.documentImage, {
            filename: 'document.jpg',
            contentType: 'image/jpeg'
        });

        // Add API key
        formData.append('apikey', this.providerConfig.apiKey);

        // Document type mapping
        const documentType = this.providerConfig.supportedDocuments[documentData.idType];
        if (documentType) {
            formData.append('document_type', documentType);
        }

        // Add expected data for verification
        formData.append('expected_firstname', documentData.firstName);
        formData.append('expected_lastname', documentData.lastName);
        formData.append('expected_dob', this.formatDateForAPI(documentData.dateOfBirth));

        // Add document-specific expected data
        if (documentData.idType === 'Driver\'s Licence') {
            formData.append('expected_licensenumber', documentData.documentNumber);
        } else if (documentData.idType === 'Passport') {
            formData.append('expected_passportnumber', documentData.documentNumber);
        }

        // console.log('ID Analyzer API Request:', {
        //     url: `${this.providerConfig.baseUrl}${this.providerConfig.endpoint}`,
        //     apiKey: this.providerConfig.apiKey,
        //     documentType: documentType
        // });

        const response = await axios.post(
            `${this.providerConfig.baseUrl}${this.providerConfig.endpoint}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                timeout: this.config.settings.timeout
            }
        );

        return this.parseIDAnalyzerResponse(response.data);
    }

    /**
     * Verify document using IDScan.net
     */
    async verifyWithIDScan(documentData) {
        const formData = new FormData();

        formData.append('image', documentData.documentImage, {
            filename: 'document.jpg',
            contentType: 'image/jpeg'
        });

        formData.append('api_key', this.providerConfig.apiKey);

        // Add expected data
        const verificationData = {
            first_name: documentData.firstName,
            last_name: documentData.lastName,
            date_of_birth: this.formatDateForAPI(documentData.dateOfBirth),
            document_type: this.providerConfig.supportedDocuments[documentData.idType]
        };

        Object.keys(verificationData).forEach(key => {
            formData.append(key, verificationData[key]);
        });

        const response = await axios.post(
            `${this.providerConfig.baseUrl}${this.providerConfig.endpoint}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                },
                timeout: this.config.settings.timeout
            }
        );

        return this.parseIDScanResponse(response.data);
    }

    /**
     * Verify document using Veryfi
     */
    async verifyWithVeryfi(documentData) {
        const formData = new FormData();

        formData.append('file', documentData.documentImage, {
            filename: 'document.jpg',
            contentType: 'image/jpeg'
        });

        const response = await axios.post(
            `${this.providerConfig.baseUrl}${this.providerConfig.endpoint}`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'X-Veryfi-Client-ID': this.providerConfig.clientId,
                    'X-Veryfi-Client-Secret': this.providerConfig.clientSecret
                },
                timeout: this.config.settings.timeout
            }
        );

        return this.parseVeryfiResponse(response.data);
    }

    /**
     * Verify document using Azure Document Intelligence
     */
    async verifyWithAzure(documentData) {
        const response = await axios.post(
            `${this.providerConfig.endpoint}/documentModels/${this.providerConfig.modelId}:analyze`,
            {
                base64Source: documentData.documentImage.toString('base64')
            },
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.providerConfig.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: this.config.settings.timeout
            }
        );

        return this.parseAzureResponse(response.data);
    }

    /**
     * Mock verification for testing (always returns success)
     */
    async verifyWithMock(documentData) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Always return success for testing
        return {
            success: true,
            verified: true,
            confidence: 95,
            extractedData: {
                firstName: documentData.firstName,
                lastName: documentData.lastName,
                dateOfBirth: documentData.dateOfBirth,
                documentNumber: documentData.documentNumber,
                documentType: this.providerConfig.supportedDocuments[documentData.idType]
            },
            verificationDetails: {
                passed: true,
                confidence: 95,
                provider: 'mock'
            },
            rawResponse: {
                status: 'success',
                message: 'Mock verification successful',
                provider: 'mock'
            }
        };
    }

    /**
     * Validate document data
     */
    validateDocumentData(documentData) {
        const required = ['idType', 'firstName', 'lastName', 'dateOfBirth', 'documentNumber'];

        for (const field of required) {
            if (!documentData[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!documentData.documentImage) {
            throw new Error('Document image is required');
        }

        // Validate date format (DD/MM/YYYY)
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!dateRegex.test(documentData.dateOfBirth)) {
            throw new Error('Date of birth must be in DD/MM/YYYY format');
        }
    }

    /**
     * Check if document type is supported by current provider
     */
    isDocumentTypeSupported(idType) {
        return this.providerConfig.supportedDocuments &&
            this.providerConfig.supportedDocuments[idType];
    }

    /**
     * Format date for API submission
     */
    formatDateForAPI(dateString) {
        // Convert DD/MM/YYYY to YYYY-MM-DD for most APIs
        const [day, month, year] = dateString.split('/');
        return `${year}-${month}-${day}`;
    }

    /**
     * Parse ID Analyzer response
     */
    parseIDAnalyzerResponse(data) {
        console.log('ID Analyzer Response:', data);

        // Check if we have a successful result
        const hasResult = data.result && Object.keys(data.result).length > 0;
        const matchRate = data.matchrate || 0;

        return {
            success: hasResult,
            verified: hasResult && matchRate > 0.8, // 80% match rate threshold
            confidence: Math.round(matchRate * 100),
            extractedData: {
                firstName: data.result?.firstName,
                lastName: data.result?.lastName,
                dateOfBirth: data.result?.dob,
                documentNumber: data.result?.documentNumber,
                documentType: data.result?.documentType,
                fullName: data.result?.fullName,
                expiry: data.result?.expiry,
                nationality: data.result?.nationality_full
            },
            verificationDetails: {
                matchRate: matchRate,
                documentType: data.result?.documentType,
                issuerOrg: data.result?.issuerOrg_full,
                nationality: data.result?.nationality_full,
                daysToExpiry: data.result?.daysToExpiry
            },
            rawResponse: data
        };
    }

    /**
     * Parse IDScan response
     */
    parseIDScanResponse(data) {
        return {
            success: data.success === true,
            verified: data.verified === true,
            confidence: data.confidence || 0,
            extractedData: {
                firstName: data.first_name,
                lastName: data.last_name,
                dateOfBirth: data.date_of_birth,
                documentNumber: data.document_number,
                documentType: data.document_type
            },
            verificationDetails: data.verification || {},
            rawResponse: data
        };
    }

    /**
     * Parse Veryfi response
     */
    parseVeryfiResponse(data) {
        return {
            success: data.status === 'completed',
            verified: data.verification && data.verification.verified,
            confidence: data.confidence || 0,
            extractedData: {
                firstName: data.first_name,
                lastName: data.last_name,
                dateOfBirth: data.date_of_birth,
                documentNumber: data.document_number,
                documentType: data.document_type
            },
            verificationDetails: data.verification || {},
            rawResponse: data
        };
    }

    /**
     * Parse Azure response
     */
    parseAzureResponse(data) {
        const document = data.analyzeResult?.documents?.[0];
        const fields = document?.fields || {};

        return {
            success: true,
            verified: document ? true : false,
            confidence: document?.confidence || 0,
            extractedData: {
                firstName: fields.firstName?.value,
                lastName: fields.lastName?.value,
                dateOfBirth: fields.dateOfBirth?.value,
                documentNumber: fields.documentNumber?.value,
                documentType: fields.documentType?.value
            },
            verificationDetails: document || {},
            rawResponse: data
        };
    }

    /**
     * Get supported document types for current provider
     */
    getSupportedDocumentTypes() {
        return Object.keys(this.providerConfig.supportedDocuments || {});
    }

    /**
     * Get provider information
     */
    getProviderInfo() {
        return {
            provider: this.provider,
            supportedDocuments: this.getSupportedDocumentTypes(),
            settings: this.config.settings
        };
    }
}

module.exports = new DVSService();
