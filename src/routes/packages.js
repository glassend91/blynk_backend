const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
    getAllAvailablePackages,
    getMyPackages,
    getMySelectedPackages,
    getPackageById,
    createPackage,
    selectPackage,
    checkPackageSelection,
    updatePackage,
    updatePackageUsage,
    getPackageUsageStats,
    cancelPackageSelection,
    deletePackage
} = require('../controllers/packageController');

// Import auth middleware
const { authenticateToken } = require('../middleware/auth');

// Validation middleware for package creation
const validatePackageCreation = [
    body('planTitle')
        .notEmpty()
        .withMessage('Plan title is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Plan title must be between 2 and 100 characters'),

    body('planType')
        .isIn(['Mobile Plan', 'Data Only', 'Voice Plan', 'Unlimited Plan'])
        .withMessage('Invalid plan type'),

    body('associatedNumber')
        .notEmpty()
        .withMessage('Associated number is required')
        .matches(/^[0-9\s\-\(\)]+$/)
        .withMessage('Associated number must contain only numbers, spaces, hyphens, and parentheses')
        .isLength({ min: 8, max: 20 })
        .withMessage('Associated number must be between 8 and 20 characters'),

    body('totalData')
        .isNumeric()
        .withMessage('Total data must be a number')
        .isFloat({ min: 0 })
        .withMessage('Total data must be a positive number'),

    body('price')
        .isNumeric()
        .withMessage('Price must be a number')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),

    body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'AUD'])
        .withMessage('Invalid currency'),

    body('validityDays')
        .isNumeric()
        .withMessage('Validity days must be a number')
        .isInt({ min: 1 })
        .withMessage('Validity days must be at least 1'),

    body('resetDate')
        .isISO8601()
        .withMessage('Reset date must be a valid date')
        .custom((value) => {
            const date = new Date(value);
            const now = new Date();
            if (date <= now) {
                throw new Error('Reset date must be in the future');
            }
            return true;
        }),

    body('description')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Description must be a string with max 500 characters'),

    body('features')
        .optional()
        .isArray()
        .withMessage('Features must be an array')
];

// Validation middleware for package selection
const validatePackageSelection = [
    body('paymentMethod')
        .isIn(['credit_card', 'debit_card', 'bank_transfer', 'wallet', 'crypto'])
        .withMessage('Invalid payment method'),

    body('customerNumber')
        .notEmpty()
        .withMessage('Customer number is required')
        .matches(/^[0-9\s\-\(\)]+$/)
        .withMessage('Customer number must contain only numbers, spaces, hyphens, and parentheses')
        .isLength({ min: 8, max: 20 })
        .withMessage('Customer number must be between 8 and 20 characters'),

    body('paymentStatus')
        .optional()
        .isIn(['pending', 'paid', 'failed', 'refunded'])
        .withMessage('Invalid payment status')
];

// Validation middleware for usage updates
const validateUsageUpdate = [
    body('usedData')
        .isNumeric()
        .withMessage('Used data must be a number')
        .isFloat({ min: 0 })
        .withMessage('Used data must be a positive number'),

    body('action')
        .optional()
        .isIn(['add', 'subtract', 'set'])
        .withMessage('Action must be add, subtract, or set'),

    body('note')
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage('Note must be a string with max 200 characters')
];

// Public routes (no auth required for browsing)
// GET /api/packages/available - Browse all available packages
router.get('/available', getAllAvailablePackages);

// GET /api/packages/:id - Get single package details
router.get('/:id', getPackageById);

// GET /api/packages/:id/check - Check if user has selected this package
router.get('/:id/check', authenticateToken, checkPackageSelection);

// Protected routes (auth required)
// GET /api/packages/my - Get packages created by current user (providers)
router.get('/my', authenticateToken, getMyPackages);

// GET /api/packages/my/selected - Get packages selected by current user (customers)
router.get('/my/selected', authenticateToken, getMySelectedPackages);

// POST /api/packages - Create a new package (providers)
router.post('/', authenticateToken, validatePackageCreation, createPackage);

// POST /api/packages/:id/select - Select/Buy a package (customers)
router.post('/:id/select', authenticateToken, validatePackageSelection, selectPackage);

// PUT /api/packages/:id - Update a package (provider only)
router.put('/:id', authenticateToken, validatePackageCreation, updatePackage);

// PATCH /api/packages/:id/usage - Update usage for selected package (customers)
router.patch('/:id/usage', authenticateToken, validateUsageUpdate, updatePackageUsage);

// GET /api/packages/:id/stats - Get usage statistics (provider only)
router.get('/:id/stats', authenticateToken, getPackageUsageStats);

// DELETE /api/packages/:id/select - Cancel package selection (customers)
router.delete('/:id/select', authenticateToken, cancelPackageSelection);

// DELETE /api/packages/:id - Delete package (provider only)
router.delete('/:id', authenticateToken, deletePackage);

module.exports = router;