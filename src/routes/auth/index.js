const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');

const router = express.Router();

const JWT_EXPIRES_IN = '7d';

function createToken(userId) {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
    return jwt.sign({ sub: userId }, secret, { expiresIn: JWT_EXPIRES_IN });
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
                otpVerified: true,
            });

            const token = createToken(user.id);
            return res.status(201).json({ token, user: user.toSafeJSON(), success: true });
        } catch (err) {
            next(err);
        }
    }
);

// OTP endpoints (stubbed to bypass for now)
router.post('/otp/send', [body('phone').isString().trim()], async (req, res) => {
    return res.json({ success: true, message: 'OTP sent (bypassed).' });
});

router.post('/otp/verify', [body('phone').isString().trim(), body('code').isString().trim()], async (req, res) => {
    return res.json({ success: true, verified: true, message: 'OTP verified (bypassed).' });
});

router.post(
    '/login',
    [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
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
