const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const { sendOTPEmail, sendWelcomeEmail } = require('../../utils/emailService');

const router = express.Router();

const JWT_EXPIRES_IN = '7d';
const OTP_EXPIRY_MINUTES = 10;

function createToken(userId) {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    return jwt.sign({ sub: userId }, secret, { expiresIn: JWT_EXPIRES_IN });
}

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post(
    '/signup',
    [
        body('firstName').isString().trim().notEmpty(),
        body('lastName').isString().trim().notEmpty(),
        body('email').isEmail(),
        // body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 6 }),
        body('phone').optional().isString().trim(),
        body('serviceAddress').optional().isString().trim(),
        body('type').optional().isIn(['NBN', 'MBL', 'MBB', 'SME']),
        // MBL optional fields
        body('mblSelectedNumber').optional().isString().trim(),
        body('mblKeepExistingNumber').optional().isBoolean(),
        body('mblCurrentMobileNumber').optional().isString().trim(),
        body('mblCurrentProvider').optional().isString().trim(),
        body('dateOfBirth').optional().isString().trim(),
        body('identity').optional().isObject(),
        body('businessDetails').optional().isObject(),
        body('simType').optional().isIn(['eSim', 'physical']),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                firstName,
                lastName,
                email,
                password,
                phone,
                serviceAddress,
                type,
                mblSelectedNumber,
                mblKeepExistingNumber,
                mblCurrentMobileNumber,
                mblCurrentProvider,
                dateOfBirth,
                identity,
                businessDetails,
                simType,
            } = req.body;

            console.log('body', req.body);

            const existing = await User.findOne({ email });
            if (existing) {
                return res.status(409).json({ message: 'Email already registered' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const user = await User.create({
                firstName,
                lastName,
                email,
                phone,
                serviceAddress,
                type,
                mblSelectedNumber,
                mblKeepExistingNumber,
                mblCurrentMobileNumber,
                mblCurrentProvider,
                dateOfBirth,
                identity,
                businessDetails,
                simType,
                passwordHash,
                otpVerified: false,
            });

            const token = createToken(user.id);
            return res.status(201).json({
                token,
                user: user.toSafeJSON(),
                success: true,
                message: 'Account created successfully. Please request OTP to verify your email.'
            });
        } catch (err) {
            next(err);
        }
    }
);

// OTP endpoints - Separate from signup flow
router.post(
    '/otp/send',
    [body('email').isEmail().withMessage('Valid email is required')],
    async (req, res, next) => {
        try {
            console.log('req.body', req.body);
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email } = req.body;

            const user = await User.findOne({ email });
            console.log('user', user);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found. Please sign up first.'
                });
            }

            if (user.otpVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already verified'
                });
            }

            // Generate new OTP
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

            user.otp = otp;
            user.otpExpiry = otpExpiry;
            await user.save();

            // Send OTP email
            try {
                await sendOTPEmail(email, otp, user.firstName);
                return res.json({
                    success: true,
                    message: 'OTP sent to your email successfully',
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

// Resend OTP - Same as send OTP
router.post(
    '/otp/resend',
    [body('email').isEmail().withMessage('Valid email is required')],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found. Please sign up first.'
                });
            }

            if (user.otpVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already verified'
                });
            }

            // Generate new OTP
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

            user.otp = otp;
            user.otpExpiry = otpExpiry;
            await user.save();

            // Send OTP email
            try {
                await sendOTPEmail(email, otp, user.firstName);
                return res.json({
                    success: true,
                    message: 'OTP resent to your email successfully',
                    expiresIn: `${OTP_EXPIRY_MINUTES} minutes`
                });
            } catch (emailError) {
                console.error('Failed to resend OTP email:', emailError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to resend OTP email. Please try again.'
                });
            }
        } catch (err) {
            next(err);
        }
    }
);

// Verify OTP - Separate from signup flow
router.post(
    '/otp/verify',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('code').isString().trim().notEmpty().withMessage('OTP code is required')
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

            const { email, code } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found. Please sign up first.'
                });
            }

            if (user.otpVerified) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already verified'
                });
            }

            if (!user.otp || !user.otpExpiry) {
                return res.status(400).json({
                    success: false,
                    message: 'No OTP found. Please request OTP first.'
                });
            }

            // Check if OTP is expired
            if (new Date() > user.otpExpiry) {
                return res.status(400).json({
                    success: false,
                    message: 'OTP has expired. Please request a new OTP.'
                });
            }

            // Verify OTP
            if (user.otp !== code) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid OTP code'
                });
            }

            // Mark as verified and clear OTP
            user.otpVerified = true;
            user.otp = undefined;
            user.otpExpiry = undefined;
            await user.save();

            // Send welcome email
            // try {
            //     await sendWelcomeEmail(email, user.firstName);
            // } catch (emailError) {
            //     console.error('Failed to send welcome email:', emailError);
            //     // Don't fail verification if welcome email fails
            // }

            return res.json({
                success: true,
                verified: true,
                message: 'Email verified successfully',
                user: user.toSafeJSON()
            });
        } catch (err) {
            next(err);
        }
    }
);

router.post(
    '/login',
    [body('email').isEmail(), body('password').isString().notEmpty()],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email, password } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const match = await bcrypt.compare(password, user.passwordHash);
            if (!match) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            const token = createToken(user.id);
            return res.json({ token, user: user.toSafeJSON(), success: true });
        } catch (err) {
            next(err);
        }
    }
);

// Simple auth middleware using Bearer token
function authRequired(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });
    try {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const payload = jwt.verify(token, secret);
        req.userId = payload.sub;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

router.get('/me', authRequired, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        return res.json({ user: user.toSafeJSON() });
    } catch (err) {
        next(err);
    }
});

// Check if email already exists
router.post(
    '/check-email',
    [
        body('email').isEmail().withMessage('Valid email is required'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email } = req.body;

            const existingUser = await User.findOne({ email });

            return res.json({
                exists: !!existingUser,
                message: existingUser ? 'Email is already registered' : 'Email is available'
            });

        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
