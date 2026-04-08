const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { sendOTPEmail } = require('../utils/emailService');
const otpProviderService = require('../services/otpProviderService');

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();
const OTP_EXPIRY_MINUTES = 10;

// Clean up expired OTPs periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of otpStore.entries()) {
        if (value.expiry < now) {
            otpStore.delete(key);
        }
    }
}, 60000); // Clean up every minute

/**
 * POST /api/v1/mobile/send-otp
 * Send OTP to email for mobile number porting verification
 * Body: { phoneNumber: string, provider: string, email: string }
 */
router.post(
    '/send-otp',
    [
        body('phoneNumber').isString().trim().notEmpty().withMessage('Phone number is required'),
        body('provider').optional().isString().trim(),
        body('email').isEmail().withMessage('Valid email is required'),
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

            const { phoneNumber, provider, email } = req.body;

            // Generate OTP
            const otp = generateOTP();
            const otpExpiry = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

            // Store OTP with phone number as key (for verification)
            otpStore.set(phoneNumber, {
                otp,
                expiry: otpExpiry,
                provider: provider || 'Unknown',
                email: email,
                attempts: 0
            });

            // Send OTP via SMS
            try {
                // Send email OTP (commented out)
                /* 
                const emailPromise = sendOTPEmail(email, otp, 'User');
                */

                // Send SMS OTP via external provider
                const smsRes = await otpProviderService.sendSMSOTP(phoneNumber);

                if (smsRes.success) {
                    const transactionId = smsRes.data?.transactionId || smsRes.data?.data?.transactionId;
                    console.log(`[MOBILE PORTING OTP] SMS sent successfully. Transaction ID: ${transactionId}`);

                    // Store transactionId for verification
                    const storedData = otpStore.get(phoneNumber);
                    if (storedData) {
                        storedData.transactionId = transactionId;
                        otpStore.set(phoneNumber, storedData);
                    }

                    return res.json({
                        success: true,
                        message: `OTP sent to ${phoneNumber} successfully for porting verification`,
                        expiresIn: `${OTP_EXPIRY_MINUTES} minutes`,
                        transactionId // Optional: send to frontend if needed
                    });
                } else {
                    console.error(`[MOBILE PORTING OTP] SMS failed:`, smsRes.error || smsRes.message);
                    return res.status(500).json({
                        success: false,
                        message: smsRes.error.message || smsRes.message || 'Failed to send SMS OTP. Please try again.'
                    });
                }
            } catch (err) {
                console.error('Error in send-otp flow:', err);
                next(err);
            }

        } catch (err) {
            next(err);
        }
    }
);

/**
 * POST /api/v1/mobile/verify-otp
 * Verify OTP for mobile number porting
 * Body: { phoneNumber: string, otp: string }
 */
router.post(
    '/verify-otp',
    [
        body('phoneNumber').isString().trim().notEmpty().withMessage('Phone number is required'),
        body('otp').isString().trim().notEmpty().withMessage('OTP code is required'),
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

            const { phoneNumber, otp } = req.body;

            // Get stored OTP
            const storedData = otpStore.get(phoneNumber);

            if (!storedData || !storedData.transactionId) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: !storedData ? 'No OTP found for this phone number. Please request OTP first.' : 'No active OTP transaction found. Please request a new OTP.'
                });
            }

            // Check if OTP is expired
            if (Date.now() > storedData.expiry) {
                otpStore.delete(phoneNumber);
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'OTP has expired. Please request a new OTP.'
                });
            }


            // Check attempt limit
            // if (storedData.attempts >= 5) {
            //     otpStore.delete(phoneNumber);
            //     return res.status(400).json({
            //         success: false,
            //         verified: false,
            //         message: 'Too many verification attempts. Please request a new OTP.'
            //     });
            // }

            // Verify via external provider
            const verifyRes = await otpProviderService.verifySMSOTP(storedData.transactionId, otp);

            if (verifyRes.success && (verifyRes.data?.success || verifyRes.data?.verified)) {
                // OTP verified successfully - remove from store
                otpStore.delete(phoneNumber);

                return res.json({
                    success: true,
                    verified: true,
                    message: 'Phone number ownership verified successfully for porting'
                });
            } else {
                storedData.attempts += 1;
                otpStore.set(phoneNumber, storedData);

                const errorMessage = verifyRes.error?.message || verifyRes.message || 'Invalid OTP code. Please try again.';
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: errorMessage
                });
            }

        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/v1/mobile/reserve/numbers
 * Get available mobile numbers for selection
 */
router.get(
    '/reserve/numbers',
    async (req, res, next) => {
        try {
            const apiRes = await otpProviderService.getAvailableNumbers();

            if (!apiRes.success) {
                return res.status(500).json({
                    success: false,
                    message: apiRes.message || 'Failed to fetch available numbers'
                });
            }

            // Transform the object structure from ConnectTel into a simple array of strings
            // ConnectTel returns: { data: { numbers: { "0412345678": { ... }, ... } } }
            const numbersData = apiRes.data?.data?.numbers || {};
            const availableNumbers = Object.keys(numbersData);

            return res.json({
                success: true,
                numbers: availableNumbers
            });
        } catch (err) {
            console.error('[MOBILE ROUTE] Error in /reserve/numbers:', err);
            next(err);
        }
    }
);

module.exports = router;

