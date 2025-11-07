const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { sendOTPEmail } = require('../utils/emailService');

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

            // Send OTP via email
            try {
                await sendOTPEmail(email, otp, 'User');
                console.log(`[MOBILE PORTING OTP] Phone: ${phoneNumber}, Email: ${email}, OTP sent via email`);

                return res.json({
                    success: true,
                    message: `OTP sent to ${email} successfully for porting verification`,
                    expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
                });
            } catch (emailError) {
                console.error('Failed to send OTP email:', emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP email. Please try again.'
                });
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

            if (!storedData) {
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'No OTP found for this phone number. Please request OTP first.'
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

            // Check attempt limit (prevent brute force)
            if (storedData.attempts >= 5) {
                otpStore.delete(phoneNumber);
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'Too many verification attempts. Please request a new OTP.'
                });
            }

            // Verify OTP
            if (storedData.otp !== otp) {
                storedData.attempts += 1;
                otpStore.set(phoneNumber, storedData);
                return res.status(400).json({
                    success: false,
                    verified: false,
                    message: 'Invalid OTP code. Please try again.'
                });
            }

            // OTP verified successfully - remove from store
            otpStore.delete(phoneNumber);

            return res.json({
                success: true,
                verified: true,
                message: 'Phone number ownership verified successfully for porting'
            });
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
            // TODO: Integrate with actual mobile number provider API
            // For now, return mock numbers
            const availableNumbers = [
                '0412 345 678',
                '0423 456 789',
                '0434 567 890',
                '0445 678 901',
                '0456 789 012',
                '0467 890 123',
                '0478 901 234',
                '0489 012 345',
            ];

            return res.json({
                success: true,
                numbers: availableNumbers
            });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;

