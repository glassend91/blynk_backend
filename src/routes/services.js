const express = require('express');
const { body, validationResult } = require('express-validator');
const ServiceController = require('../controllers/serviceController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public: fetch services for unauthenticated flows (signup, marketing)
router.get('/', ServiceController.getPublicServices);

// Public: fetch wholesaler rate plans (used in signup)
router.get('/wholesaler/rate-plans', ServiceController.getWholesalerRatePlans);

// Public: fetch wholesaler address autocomplete (used in signup)
router.get('/wholesaler/address-autocomplete', ServiceController.getWholesalerAddressAutocomplete);

// Public: check NBN availability (Search + SQ)
router.post('/wholesaler/nbn-availability', ServiceController.getNbnAvailability);

// Apply authentication to all routes after the public ones
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

// Admin-only services listing
router.get('/admin/list', requireAdmin, ServiceController.getServicesForAdmin);

// Admin: Get service by ID for editing
router.get('/admin/:serviceId', requireAdmin, ServiceController.getServiceForAdmin);

// Admin: create service
router.post(
    '/admin',
    requireAdmin,
    [
        body('serviceName').isString().trim().notEmpty().withMessage('Service name is required'),
        body('serviceType')
            .isIn(['NBN', 'Business NBN', 'Mobile', 'Data Only', 'Voice Only'])
            .withMessage('Invalid service type'),
        body('price')
            .isFloat({ min: 0 })
            .withMessage('Price must be a positive number'),
        body('status')
            .optional()
            .isIn(['Published', 'Draft', 'Staff-Only', 'Hidden'])
            .withMessage('Status must be Published, Draft, Staff-Only, or Hidden'),
        body('billingCycle')
            .optional()
            .isIn(['monthly', 'quarterly', 'yearly'])
            .withMessage('Invalid billing cycle'),
        body('currency')
            .optional()
            .isIn(['AUD', 'USD', 'EUR', 'GBP'])
            .withMessage('Invalid currency'),
        body('speedOrData')
            .optional()
            .isString()
            .withMessage('Speed/Data must be a string'),
        body('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
        body('features')
            .optional()
            .isArray()
            .withMessage('Features must be an array of strings'),
    ],
    validateRequest,
    ServiceController.createService
);

// Admin: update service
router.put(
    '/admin/:serviceId',
    requireAdmin,
    [
        body('serviceName').isString().trim().notEmpty().withMessage('Service name is required'),
        body('serviceType')
            .isIn(['NBN', 'Business NBN', 'Mobile', 'Data Only', 'Voice Only'])
            .withMessage('Invalid service type'),
        body('price')
            .isFloat({ min: 0 })
            .withMessage('Price must be a positive number'),
        body('status')
            .optional()
            .isIn(['Published', 'Draft', 'Staff-Only', 'Hidden'])
            .withMessage('Status must be Published, Draft, Staff-Only, or Hidden'),
        body('billingCycle')
            .optional()
            .isIn(['monthly', 'quarterly', 'yearly'])
            .withMessage('Invalid billing cycle'),
        body('currency')
            .optional()
            .isIn(['AUD', 'USD', 'EUR', 'GBP'])
            .withMessage('Invalid currency'),
        body('speedOrData')
            .optional()
            .isString()
            .withMessage('Speed/Data must be a string'),
        body('description')
            .optional()
            .isString()
            .withMessage('Description must be a string'),
        body('features')
            .optional()
            .isArray()
            .withMessage('Features must be an array of strings'),
    ],
    validateRequest,
    ServiceController.updateService
);

// Admin: toggle service active status (hide/show)
router.patch(
    '/admin/:serviceId/active',
    requireAdmin,
    [
        body('isActive')
            .isBoolean()
            .withMessage('isActive must be a boolean'),
    ],
    validateRequest,
    ServiceController.toggleServiceActive
);

// Admin: delete service (soft delete)
router.delete(
    '/admin/:serviceId',
    requireAdmin,
    ServiceController.deleteService
);

// (Protected) Get all available services with optional filtering - requires auth
router.get(
    '/',
    ServiceController.getServices
);

// Get service by ID
router.get(
    '/:serviceId',
    ServiceController.getServiceById
);

// Subscribe to a service
router.post(
    '/:serviceId/subscribe',
    [
        body('assignedAddress.streetAddress')
            .optional()
            .isString()
            .withMessage('Street address must be a string'),
        body('assignedAddress.suburb')
            .optional()
            .isString()
            .withMessage('Suburb must be a string'),
        body('assignedAddress.city')
            .optional()
            .isString()
            .withMessage('City must be a string'),
        body('assignedAddress.state')
            .optional()
            .isString()
            .withMessage('State must be a string'),
        body('assignedAddress.postcode')
            .optional()
            .isString()
            .withMessage('Postcode must be a string'),
        body('assignedNumber')
            .optional()
            .isString()
            .withMessage('Assigned number must be a string'),
        body('selectedAddOns')
            .optional()
            .isArray()
            .withMessage('Selected add-ons must be an array'),
        body('paymentMethodId')
            .optional()
            .isMongoId()
            .withMessage('Payment method ID must be a valid MongoDB ID')
    ],
    validateRequest,
    ServiceController.subscribeToService
);

// Get user's subscriptions
router.get(
    '/subscriptions/my',
    ServiceController.getUserSubscriptions
);

// Update subscription status (admin or user)
router.put(
    '/subscriptions/:subscriptionId/status',
    [
        body('status')
            .isIn(['active', 'inactive', 'suspended', 'cancelled'])
            .withMessage('Status must be one of: active, inactive, suspended, cancelled'),
        body('reason')
            .optional()
            .isString()
            .withMessage('Reason must be a string')
    ],
    validateRequest,
    ServiceController.updateSubscriptionStatus
);

// Add add-on to subscription
router.post(
    '/subscriptions/:subscriptionId/add-ons',
    [
        body('addOnId')
            .notEmpty()
            .withMessage('Add-on ID is required')
    ],
    validateRequest,
    ServiceController.addAddOn
);

// Remove add-on from subscription
router.delete(
    '/subscriptions/:subscriptionId/add-ons/:addOnId',
    ServiceController.removeAddOn
);

// Update subscription configuration
router.put(
    '/subscriptions/:subscriptionId/config',
    [
        body('configuration.autoPay')
            .optional()
            .isBoolean()
            .withMessage('Auto-pay must be a boolean'),
        body('configuration.emailNotifications')
            .optional()
            .isBoolean()
            .withMessage('Email notifications must be a boolean'),
        body('configuration.smsNotifications')
            .optional()
            .isBoolean()
            .withMessage('SMS notifications must be a boolean'),
        body('configuration.usageAlerts')
            .optional()
            .isBoolean()
            .withMessage('Usage alerts must be a boolean'),
        body('configuration.usageThreshold')
            .optional()
            .isInt({ min: 0, max: 100 })
            .withMessage('Usage threshold must be between 0 and 100')
    ],
    validateRequest,
    ServiceController.updateSubscriptionConfig
);

// Cancel subscription
router.post(
    '/subscriptions/:subscriptionId/cancel',
    [
        body('reason')
            .optional()
            .isString()
            .withMessage('Reason must be a string')
    ],
    validateRequest,
    ServiceController.cancelSubscription
);

// Get subscription usage
router.get(
    '/subscriptions/:subscriptionId/usage',
    ServiceController.getSubscriptionUsage
);

// Update subscription usage
router.put(
    '/subscriptions/:subscriptionId/usage',
    [
        body('amount')
            .isFloat({ min: 0 })
            .withMessage('Amount must be a positive number'),
        body('type')
            .isIn(['data', 'voice', 'sms'])
            .withMessage('Type must be one of: data, voice, sms'),
        body('note')
            .optional()
            .isString()
            .withMessage('Note must be a string')
    ],
    validateRequest,
    ServiceController.updateSubscriptionUsage
);

module.exports = router;
