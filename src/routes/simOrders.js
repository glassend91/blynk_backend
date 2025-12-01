const express = require('express');
const router = express.Router();
const simOrderController = require('../controllers/simOrderController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/sim-orders
 * @desc    Get all SIM orders with optional filtering
 * @access  Private (Admin)
 * @query   status, search
 */
router.get('/', simOrderController.getAllOrders);

/**
 * @route   GET /api/sim-orders/:id
 * @desc    Get SIM order by ID
 * @access  Private (Admin)
 */
router.get('/:id', simOrderController.getOrderById);

/**
 * @route   POST /api/sim-orders
 * @desc    Create a new SIM order
 * @access  Private (Admin)
 * @body    orderNumber, customer, email, plan, orderDate
 */
router.post('/', simOrderController.createOrder);

/**
 * @route   PUT /api/sim-orders/:id
 * @desc    Update a SIM order
 * @access  Private (Admin)
 * @body    customer, email, plan, orderDate
 */
router.put('/:id', simOrderController.updateOrder);

/**
 * @route   POST /api/sim-orders/:id/enter-iccid
 * @desc    Enter ICCID for an order
 * @access  Private (Admin)
 * @body    iccid
 */
router.post('/:id/enter-iccid', simOrderController.enterIccid);

/**
 * @route   POST /api/sim-orders/:id/provision
 * @desc    Provision a SIM order
 * @access  Private (Admin)
 * @body    provisioningNotes (optional)
 */
router.post('/:id/provision', simOrderController.provisionOrder);

/**
 * @route   DELETE /api/sim-orders/:id
 * @desc    Delete a SIM order (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', simOrderController.deleteOrder);

module.exports = router;

