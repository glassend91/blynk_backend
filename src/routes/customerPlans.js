const express = require('express');
const router = express.Router();
const customerPlansController = require('../controllers/customerPlansController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/customer-plans/services
 * @desc    Get all available services
 * @access  Private (Admin)
 */
router.get('/services', customerPlansController.getAvailableServices);

/**
 * @route   GET /api/customer-plans/search
 * @desc    Search customer by email/name/phone and get their plans
 * @access  Private (Admin)
 * @query   query (email, name, or phone)
 */
router.get('/search', customerPlansController.searchCustomerPlans);

/**
 * @route   POST /api/customer-plans/add-service
 * @desc    Add a service to a customer
 * @access  Private (Admin)
 * @body    customerId, serviceId, assignedAddress (optional), assignedNumber (optional)
 */
router.post('/add-service', customerPlansController.addServiceToCustomer);

/**
 * @route   GET /api/customer-plans/:customerId
 * @desc    Get all plans for a specific customer
 * @access  Private (Admin)
 */
router.get('/:customerId', customerPlansController.getCustomerPlans);

module.exports = router;

