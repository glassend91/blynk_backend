const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');

/**
 * @route   GET /api/stores
 * @desc    Get all stores with optional filtering
 * @access  Public
 * @query   status, search
 */
router.get('/', storeController.getAllStores);

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/stores/statistics
 * @desc    Get store statistics
 * @access  Private (Admin)
 */
router.get('/statistics', authenticateToken, storeController.getStatistics);

/**
 * @route   GET /api/stores/:id
 * @desc    Get store by ID
 * @access  Public
 */
router.get('/:id', storeController.getStoreById);

// Apply authentication to all following administrative routes
router.use(authenticateToken);

/**
 * @route   POST /api/stores
 * @desc    Create a new store
 * @access  Private (Admin)
 * @body    name, address, hours, phone, googleLink, bannerUrl, pitch, status, technicians
 */
router.post('/', storeController.createStore);

/**
 * @route   PUT /api/stores/:id
 * @desc    Update a store
 * @access  Private (Admin)
 * @body    name, address, hours, phone, googleLink, bannerUrl, pitch, status, technicians
 */
router.put('/:id', storeController.updateStore);

/**
 * @route   DELETE /api/stores/:id
 * @desc    Delete a store
 * @access  Private (Admin)
 */
router.delete('/:id', storeController.deleteStore);

module.exports = router;

