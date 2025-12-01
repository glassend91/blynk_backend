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

module.exports = router;

