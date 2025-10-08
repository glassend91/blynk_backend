const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const dvsService = require('../../services/dvsService');
const authRequired = require('../../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
        }
    }
});

// Get supported document types
router.get('/supported-documents', (req, res) => {
    try {
        const providerInfo = dvsService.getProviderInfo();
        res.json({
            success: true,
            provider: providerInfo.provider,
            supportedDocuments: providerInfo.supportedDocuments,
            settings: {
                maxFileSize: providerInfo.settings.maxFileSize,
                allowedFormats: providerInfo.settings.allowedFormats
            }
        });
    } catch (error) {
        console.error('Error getting supported documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get supported document types'
        });
    }
});

// Verify identity document
router.post(
    '/verify',
    // authRequired,
    upload.single('documentImage'),
    [
        body('idType').isIn(['Driver\'s Licence', 'Passport', 'Medical Card', 'I', 'PASSPORT', 'DRIVERS_LICENCE']).withMessage('Invalid document type'),
        body('firstName').isString().trim().notEmpty().withMessage('First name is required'),
        body('lastName').isString().trim().notEmpty().withMessage('Last name is required'),
        body('dateOfBirth').matches(/^\d{2}\/\d{2}\/\d{4}$/).withMessage('Date of birth must be in DD/MM/YYYY format'),
        body('documentNumber').isString().trim().notEmpty().withMessage('Document number is required'),
        // Document-specific validations
        body('stateOfIssue').if(body('idType').equals('Driver\'s Licence')).isString().trim().notEmpty().withMessage('State of issue is required for Driver\'s Licence'),
        body('countryOfIssue').if(body('idType').equals('Passport')).isString().trim().notEmpty().withMessage('Country of issue is required for Passport'),
        body('medicareCardNumber').if(body('idType').equals('Medical Card')).isString().trim().notEmpty().withMessage('Medicare card number is required for Medical Card'),
        body('IRN').if(body('idType').equals('Medical Card')).isString().trim().notEmpty().withMessage('IRN is required for Medical Card'),
        body('expiryDate').if(body('idType').equals('Medical Card')).isString().trim().notEmpty().withMessage('Expiry date is required for Medical Card'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }
            // console.log(req.body);
            console.log(req.file);

            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Document image is required'
                });
            }

            // const userId = req.userId;
            // const user = await User.findById(userId);
            // if (!user) {
            //     return res.status(404).json({
            //         success: false,
            //         message: 'User not found'
            //     });
            // }

            // Check if identity is already verified
            // if (user.identity.verified) {
            //     return res.status(400).json({
            //         success: false,
            //         message: 'Identity is already verified'
            //     });
            // }

            // Check verification attempts limit (max 3 attempts per day)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // if (user.identity.lastVerificationAttempt &&
            //     user.identity.lastVerificationAttempt >= today &&
            //     user.identity.verificationAttempts >= 3) {
            //     return res.status(429).json({
            //         success: false,
            //         message: 'Maximum verification attempts reached for today. Please try again tomorrow.'
            //     });
            // }

            const {
                idType,
                firstName,
                lastName,
                dateOfBirth,
                documentNumber,
                stateOfIssue,
                countryOfIssue,
                medicareCardNumber,
                IRN,
                expiryDate
            } = req.body;

            // Prepare document data for DVS service
            const documentData = {
                idType,
                firstName,
                lastName,
                dateOfBirth,
                documentNumber,
                documentImage: req.file.buffer,
                additionalData: {}
            };

            // Add document-specific data
            switch (idType) {
                case 'Driver\'s Licence':
                    documentData.additionalData = {
                        licenceNumber: documentNumber,
                        stateOfIssue
                    };
                    break;
                case 'Passport':
                    documentData.additionalData = {
                        passportNumber: documentNumber,
                        countryOfIssue
                    };
                    break;
                case 'Medical Card':
                    documentData.additionalData = {
                        medicareCardNumber,
                        IRN,
                        expiryDate
                    };
                    break;
            }

            // Update verification attempt
            // user.identity.lastVerificationAttempt = new Date();
            // user.identity.verificationAttempts = (user.identity.verificationAttempts || 0) + 1;
            // await user.save();

            // Call DVS service
            const verificationResult = await dvsService.verifyDocument(documentData);

            console.log('verificationResult', verificationResult);

            // // Update user identity based on verification result
            // user.identity.idType = idType;
            // user.identity.firstName = firstName;
            // user.identity.lastName = lastName;
            // user.identity.dateOfBirth = dateOfBirth;

            // Set document-specific fields
            // if (idType === 'Driver\'s Licence') {
            //     user.identity.licenceNumber = documentNumber;
            //     user.identity.stateOfIssue = stateOfIssue;
            // } else if (idType === 'Passport') {
            //     user.identity.passportNumber = documentNumber;
            //     user.identity.countryOfIssue = countryOfIssue;
            // } else if (idType === 'Medical Card') {
            //     user.identity.medicareCardNumber = medicareCardNumber;
            //     user.identity.IRN = IRN;
            //     user.identity.expiryDate = expiryDate;
            // }

            if (verificationResult.success && verificationResult.verified) {
                // Verification successful
                // user.identity.verified = true;
                // user.identity.verificationDate = new Date();
                // user.identity.verificationProvider = dvsService.getProviderInfo().provider;
                // user.identity.verificationConfidence = verificationResult.confidence;
                // user.identity.verificationDetails = verificationResult.verificationDetails;

                // await user.save();

                return res.json({
                    success: true,
                    verified: true,
                    message: 'Identity verification successful',
                    confidence: verificationResult.confidence,
                    // verificationDate: user.identity.verificationDate,
                    // user: user.toSafeJSON()
                });
            } else {
                // Verification failed
                // user.identity.verificationDetails = verificationResult.verificationDetails;
                // await user.save();

                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'Identity verification failed. Please check your document details and try again.',
                    details: verificationResult.verificationDetails,
                    // attemptsRemaining: Math.max(0, 3 - user.identity.verificationAttempts)
                });
            }

        } catch (error) {
            console.error('Identity verification error:', error);
            next(error);
        }
    }
);

// Get user's identity verification status
router.get('/status', authRequired, async (req, res, next) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('identity');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.json({
            success: true,
            identity: {
                verified: user.identity.verified,
                idType: user.identity.idType,
                verificationDate: user.identity.verificationDate,
                verificationProvider: user.identity.verificationProvider,
                verificationConfidence: user.identity.verificationConfidence,
                verificationAttempts: user.identity.verificationAttempts,
                lastVerificationAttempt: user.identity.lastVerificationAttempt,
                // Don't return sensitive document details
            }
        });
    } catch (error) {
        console.error('Error getting identity status:', error);
        next(error);
    }
});

// Reset identity verification (admin only - for testing purposes)
router.post('/reset', authRequired, async (req, res, next) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Reset verification status
        user.identity.verified = false;
        user.identity.verificationDate = undefined;
        user.identity.verificationProvider = undefined;
        user.identity.verificationConfidence = undefined;
        user.identity.verificationDetails = undefined;
        user.identity.verificationAttempts = 0;
        user.identity.lastVerificationAttempt = undefined;

        await user.save();

        return res.json({
            success: true,
            message: 'Identity verification reset successfully'
        });
    } catch (error) {
        console.error('Error resetting identity verification:', error);
        next(error);
    }
});

module.exports = router;
