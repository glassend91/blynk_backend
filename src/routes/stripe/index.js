const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('../../config/stripe');
const User = require('../../models/User');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

// Create payment intent endpoint
router.post(
    '/create-payment-intent',
    authenticateToken,
    [
        body('amount').isInt({ min: 50 }).withMessage('Amount must be at least 50 cents'),
        body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: 'Validation failed', details: errors.array() });
            }

            const { amount, currency = 'aud' } = req.body;
            const userId = req.user.id;

            // 1. Find the local user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // 2. Ensure Stripe Customer exists
            let stripeCustomerId = user.stripeCustomerId;
            if (!stripeCustomerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    metadata: { userId: user._id.toString() }
                });
                stripeCustomerId = customer.id;
                user.stripeCustomerId = stripeCustomerId;
                await user.save();
                console.log(`[STRIPE] Created new customer ${stripeCustomerId} for user ${user.email}`);
            }

            // 3. Create a direct PaymentIntent
            // Using payment_method_types: ['card'] to match the frontend Elements config
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: currency,
                customer: stripeCustomerId,
                payment_method_types: ['card'],
                metadata: {
                    userId: userId.toString(),
                    type: 'signup_fee',
                    timestamp: new Date().toISOString()
                },
                description: 'Service Signup Fee'
            });

            res.json({
                clientSecret: paymentIntent.client_secret,
                id: paymentIntent.id,
            });

        } catch (error) {
            console.error('Stripe payment intent creation failed:', error);

            // Handle specific Stripe errors
            if (error.type === 'StripeCardError') {
                return res.status(400).json({
                    error: 'Card error',
                    message: error.message
                });
            } else if (error.type === 'StripeRateLimitError') {
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please try again later.'
                });
            } else if (error.type === 'StripeInvalidRequestError') {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: error.message
                });
            } else if (error.type === 'StripeAPIError') {
                return res.status(500).json({
                    error: 'Stripe API error',
                    message: 'Payment service temporarily unavailable'
                });
            } else if (error.type === 'StripeConnectionError') {
                return res.status(500).json({
                    error: 'Connection error',
                    message: 'Unable to connect to payment service'
                });
            } else if (error.type === 'StripeAuthenticationError') {
                return res.status(500).json({
                    error: 'Authentication error',
                    message: 'Payment service configuration error'
                });
            } else {
                return res.status(500).json({
                    error: 'Internal server error',
                    message: 'Payment processing failed'
                });
            }
        }
    }
);

// Get payment intent status (optional endpoint for checking payment status)
router.get('/payment-intent/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const paymentIntent = await stripe.paymentIntents.retrieve(id);

        res.json({
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            created: paymentIntent.created,
        });
    } catch (error) {
        console.error('Failed to retrieve payment intent:', error);
        res.status(500).json({
            error: 'Failed to retrieve payment intent',
            message: error.message
        });
    }
});

module.exports = router;
