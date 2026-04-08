const express = require('express');
const { body, validationResult } = require('express-validator');
const PaymentMethodController = require('../controllers/paymentMethodController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// Create setup intent for adding payment methods
router.post(
    '/setup-intent',
    PaymentMethodController.createSetupIntent
);

// Create a new payment method
router.post(
    '/',
    [
        body('paymentMethodId')
            .notEmpty()
            .withMessage('Payment method ID is required'),
        body('billingDetails.name')
            .optional()
            .isString()
            .withMessage('Billing name must be a string'),
        body('billingDetails.email')
            .optional()
            .isEmail()
            .withMessage('Billing email must be a valid email'),
        body('billingDetails.phone')
            .optional()
            .isString()
            .withMessage('Billing phone must be a string'),
        body('billingDetails.address.line1')
            .optional()
            .isString()
            .withMessage('Address line 1 must be a string'),
        body('billingDetails.address.city')
            .optional()
            .isString()
            .withMessage('City must be a string'),
        body('billingDetails.address.state')
            .optional()
            .isString()
            .withMessage('State must be a string'),
        body('billingDetails.address.postalCode')
            .optional()
            .isString()
            .withMessage('Postal code must be a string'),
        body('billingDetails.address.country')
            .optional()
            .isString()
            .withMessage('Country must be a string')
    ],
    validateRequest,
    PaymentMethodController.createPaymentMethod
);

// Get all payment methods for the authenticated user
router.get(
    '/',
    PaymentMethodController.getPaymentMethods
);

// Get default payment method
router.get(
    '/default',
    PaymentMethodController.getDefaultPaymentMethod
);

// Set default payment method
router.put(
    '/:paymentMethodId/default',
    PaymentMethodController.setDefaultPaymentMethod
);

// Update payment method billing details
router.put(
    '/:paymentMethodId',
    [
        body('billingDetails.name')
            .optional()
            .isString()
            .withMessage('Billing name must be a string'),
        body('billingDetails.email')
            .optional()
            .isEmail()
            .withMessage('Billing email must be a valid email'),
        body('billingDetails.phone')
            .optional()
            .isString()
            .withMessage('Billing phone must be a string'),
        body('billingDetails.address.line1')
            .optional()
            .isString()
            .withMessage('Address line 1 must be a string'),
        body('billingDetails.address.line2')
            .optional()
            .isString()
            .withMessage('Address line 2 must be a string'),
        body('billingDetails.address.city')
            .optional()
            .isString()
            .withMessage('City must be a string'),
        body('billingDetails.address.state')
            .optional()
            .isString()
            .withMessage('State must be a string'),
        body('billingDetails.address.postalCode')
            .optional()
            .isString()
            .withMessage('Postal code must be a string'),
        body('billingDetails.address.country')
            .optional()
            .isString()
            .withMessage('Country must be a string')
    ],
    validateRequest,
    PaymentMethodController.updatePaymentMethod
);

// Delete payment method
router.delete(
    '/:paymentMethodId',
    PaymentMethodController.deletePaymentMethod
);

// Auto-pay settings routes
router.get(
    '/auto-pay/settings',
    PaymentMethodController.getAutoPaySettings
);

router.put(
    '/auto-pay/settings',
    [
        body('autoPayEnabled')
            .optional()
            .isBoolean()
            .withMessage('Auto-pay enabled must be a boolean'),
        body('emailNotifications')
            .optional()
            .isBoolean()
            .withMessage('Email notifications must be a boolean'),
        body('billingNotifications')
            .optional()
            .isBoolean()
            .withMessage('Billing notifications must be a boolean')
    ],
    validateRequest,
    PaymentMethodController.updateAutoPaySettings
);

module.exports = router;
