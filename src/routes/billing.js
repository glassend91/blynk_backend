const express = require('express');
const { body, query, validationResult } = require('express-validator');
const BillingController = require('../controllers/billingController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

// Get billing summary for dashboard
router.get(
    '/summary',
    BillingController.getBillingSummary
);

// Get all invoices with pagination and filtering
router.get(
    '/invoices',
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
        query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
        query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month')
    ],
    validateRequest,
    BillingController.getInvoices
);

// Get invoice by ID
router.get(
    '/invoices/:invoiceId',
    BillingController.getInvoiceById
);

// Download invoice PDF (customer-facing)
router.get(
    '/invoices/:invoiceId/download',
    BillingController.downloadInvoice
);

// Admin: Download invoice PDF for any customer
router.get(
    '/admin/invoices/:invoiceId/download',
    requireAdmin,
    BillingController.downloadCustomerInvoicePDF
);

// Get current month charges breakdown
router.get(
    '/current-month-charges',
    BillingController.getCurrentMonthCharges
);

// Get billing account details
router.get(
    '/account',
    BillingController.getBillingAccount
);

// Create billing account (for new users)
router.post(
    '/account',
    [
        body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annually']).withMessage('Invalid billing cycle'),
        body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number'),
        body('billingAddress.name').optional().isString().withMessage('Billing name must be a string'),
        body('billingAddress.line1').optional().isString().withMessage('Address line 1 must be a string'),
        body('billingAddress.line2').optional().isString().withMessage('Address line 2 must be a string'),
        body('billingAddress.city').optional().isString().withMessage('City must be a string'),
        body('billingAddress.state').optional().isString().withMessage('State must be a string'),
        body('billingAddress.postalCode').optional().isString().withMessage('Postal code must be a string'),
        body('billingAddress.country').optional().isString().withMessage('Country must be a string')
    ],
    validateRequest,
    BillingController.createBillingAccount
);

// Update billing account settings
router.put(
    '/account',
    [
        body('autoPayEnabled').optional().isBoolean().withMessage('Auto-pay enabled must be a boolean'),
        body('billingCycle').optional().isIn(['monthly', 'quarterly', 'annually']).withMessage('Invalid billing cycle'),
        body('notificationSettings.emailNotifications').optional().isBoolean().withMessage('Email notifications must be a boolean'),
        body('notificationSettings.smsNotifications').optional().isBoolean().withMessage('SMS notifications must be a boolean'),
        body('notificationSettings.billingNotifications').optional().isBoolean().withMessage('Billing notifications must be a boolean'),
        body('notificationSettings.paymentReminders').optional().isBoolean().withMessage('Payment reminders must be a boolean'),
        body('billingAddress.name').optional().isString().withMessage('Billing name must be a string'),
        body('billingAddress.line1').optional().isString().withMessage('Address line 1 must be a string'),
        body('billingAddress.line2').optional().isString().withMessage('Address line 2 must be a string'),
        body('billingAddress.city').optional().isString().withMessage('City must be a string'),
        body('billingAddress.state').optional().isString().withMessage('State must be a string'),
        body('billingAddress.postalCode').optional().isString().withMessage('Postal code must be a string'),
        body('billingAddress.country').optional().isString().withMessage('Country must be a string')
    ],
    validateRequest,
    BillingController.updateBillingSettings
);

// Generate invoice for billing period
router.post(
    '/invoices/generate',
    [
        body('billingPeriodStart').isISO8601().withMessage('Billing period start must be a valid date'),
        body('billingPeriodEnd').isISO8601().withMessage('Billing period end must be a valid date')
    ],
    validateRequest,
    BillingController.generateInvoice
);

// Generate sample invoices for testing
router.post(
    '/invoices/generate-sample',
    BillingController.generateSampleInvoices
);

// Generate monthly invoices for all active subscriptions
router.post(
    '/invoices/generate-monthly',
    BillingController.generateMonthlyInvoices
);

// Generate consolidated invoice for all services and packages
router.post(
    '/invoices/generate-consolidated',
    [
        body('billingPeriodStart').isISO8601().withMessage('Billing period start must be a valid date'),
        body('billingPeriodEnd').isISO8601().withMessage('Billing period end must be a valid date')
    ],
    validateRequest,
    BillingController.generateConsolidatedInvoice
);

// Generate invoice for specific service subscription
router.post(
    '/invoices/generate-service/:subscriptionId',
    [
        body('billingPeriodStart').isISO8601().withMessage('Billing period start must be a valid date'),
        body('billingPeriodEnd').isISO8601().withMessage('Billing period end must be a valid date')
    ],
    validateRequest,
    BillingController.generateServiceInvoice
);

// Generate invoice for specific package selection
router.post(
    '/invoices/generate-package/:packageSelectionId',
    [
        body('billingPeriodStart').isISO8601().withMessage('Billing period start must be a valid date'),
        body('billingPeriodEnd').isISO8601().withMessage('Billing period end must be a valid date')
    ],
    validateRequest,
    BillingController.generatePackageInvoice
);

// Get invoice summary
router.get(
    '/invoices/summary',
    BillingController.getInvoiceSummary
);

// Admin: Get invoices for a specific customer
router.get(
    '/admin/customers/:customerId/invoices',
    requireAdmin,
    [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']).withMessage('Invalid status'),
        query('sortBy').optional().isIn(['createdAt', 'dueDate', 'total', 'status', 'invoiceNumber']).withMessage('Invalid sort field'),
        query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
    ],
    validateRequest,
    BillingController.getCustomerInvoices
);

module.exports = router;
