const express = require('express');
const router = express.Router();
const customerVerificationController = require('../controllers/customerVerificationController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/customer-verification/statistics
 * @desc    Get verification statistics
 * @access  Private (Admin)
 */
router.get('/statistics', customerVerificationController.getStatistics);

/**
 * @route   POST /api/customer-verification/send-otp
 * @desc    Send OTP to customer via email or SMS
 * @access  Private (Admin)
 * @body    emailOrPhone, channel (email/sms), purpose (optional)
 */
router.post('/send-otp', customerVerificationController.sendOTP);

/**
 * @route   POST /api/customer-verification/verify-otp
 * @desc    Verify OTP code manually
 * @access  Private (Admin)
 * @body    emailOrPhone, otpCode, adminNotes (optional)
 */
router.post('/verify-otp', customerVerificationController.verifyOTP);

/**
 * @route   POST /api/customer-verification/manual-verify
 * @desc    Manually verify customer without OTP
 * @access  Private (Admin)
 * @body    customerIdOrEmail, adminNotes (optional)
 */
router.post('/manual-verify', customerVerificationController.manualVerification);

/**
 * @route   POST /api/customer-verification/notes
 * @desc    Create a customer note
 * @access  Private (Admin)
 * @body    customerId, noteType, priority, content, tags (optional)
 */
router.post('/notes', customerVerificationController.createCustomerNote);

/**
 * @route   GET /api/customer-verification/notes
 * @desc    Get all notes with optional filtering
 * @access  Private (Admin)
 * @query   customerId, noteType, search, limit
 */
router.get('/notes', customerVerificationController.getAllNotes);

/**
 * @route   GET /api/customer-verification/notes/:customerId
 * @desc    Get customer notes
 * @access  Private (Admin)
 */
router.get('/notes/:customerId', customerVerificationController.getCustomerNotes);

/**
 * @route   GET /api/customer-verification/search
 * @desc    Search customers and get their notes
 * @access  Private (Admin)
 * @query   query (email, phone, or name)
 */
router.get('/search', customerVerificationController.searchCustomersAndNotes);

/**
 * @route   GET /api/customer-verification/global-search
 * @desc    Global customer search across all fields (name, email, phone, ID, address, business info, ABN)
 * @access  Private (Admin)
 * @query   query - search term
 */
router.get('/global-search', customerVerificationController.globalCustomerSearch);

/**
 * @route   GET /api/customer-verification/financial/:customerId
 * @desc    Get customer financial overview (balance, next bill date, auto-pay status, payment method)
 * @access  Private (Admin)
 * @params  customerId - Customer ID
 */
router.get('/financial/:customerId', customerVerificationController.getCustomerFinancialData);

/**
 * @route   GET /api/customer-verification/authorised-reps/:customerId
 * @desc    Get authorised representatives for a customer
 * @access  Private (Admin)
 */
router.get('/authorised-reps/:customerId', customerVerificationController.getAuthorisedReps);

/**
 * @route   POST /api/customer-verification/authorised-reps/:customerId
 * @desc    Add an authorised representative
 * @access  Private (Admin)
 */
router.post('/authorised-reps/:customerId', customerVerificationController.addAuthorisedRep);

/**
 * @route   PUT /api/customer-verification/authorised-reps/:customerId/:repId
 * @desc    Update an authorised representative
 * @access  Private (Admin)
 */
router.put('/authorised-reps/:customerId/:repId', customerVerificationController.updateAuthorisedRep);

/**
 * @route   DELETE /api/customer-verification/authorised-reps/:customerId/:repId
 * @desc    Remove an authorised representative
 * @access  Private (Admin)
 */
router.delete('/authorised-reps/:customerId/:repId', customerVerificationController.removeAuthorisedRep);

module.exports = router;

