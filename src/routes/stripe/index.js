const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('../../config/stripe');

const router = express.Router();

// Create payment intent endpoint
router.post(
    '/create-payment-intent',
    [
        body('amount').isInt({ min: 50 }).withMessage('Amount must be at least 50 cents'),
        body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
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

            const { amount, currency = 'aud' } = req.body;
            console.log('amount', amount);
            console.log('currency', currency);

            // Create payment intent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: currency,
                automatic_payment_methods: {
                    enabled: true,
                },
                metadata: {
                    // Add any additional metadata you need
                    timestamp: new Date().toISOString(),
                },
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
