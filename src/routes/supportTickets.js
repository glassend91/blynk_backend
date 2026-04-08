const express = require('express');
const router = express.Router();
const supportTicketController = require('../controllers/supportTicketController');
const {
    validateCreateTicket,
    validateUpdateTicket,
    validateAddMessage,
    validateTicketId,
    validateCustomerId,
    validateAssignTicket,
    validateRateTicket,
    validateGetTicketsQuery,
    validateSearchQuery
} = require('../middleware/supportTicketValidation');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/support-tickets/statistics
 * @desc    Get support ticket statistics (Admin only)
 * @access  Private (Admin)
 */
router.get('/statistics', supportTicketController.getStatistics);

/**
 * @route   GET /api/support-tickets
 * @desc    Get all support tickets with filtering and pagination
 * @access  Private
 * @query   status, category, priority, assignedTo, search, page, limit
 */
router.get('/',
    validateGetTicketsQuery,
    supportTicketController.getTickets
);

/**
 * @route   GET /api/support-tickets/search
 * @desc    Search support tickets
 * @access  Private
 * @query   q (search term), page, limit
 */
router.get('/search',
    validateSearchQuery,
    supportTicketController.searchTickets
);

/**
 * @route   GET /api/support-tickets/customer/:customerId
 * @desc    Get tickets for a specific customer
 * @access  Private
 * @query   page, limit
 */
router.get('/customer/:customerId',
    validateCustomerId,
    supportTicketController.getCustomerTickets
);


/**
 * @route   GET /api/support-tickets/:id
 * @desc    Get ticket by MongoDB ID
 * @access  Private
 */
router.get('/:id',
    validateTicketId,
    supportTicketController.getTicketById
);

/**
 * @route   POST /api/support-tickets
 * @desc    Create a new support ticket
 * @access  Private
 * @body    subject, description, category, priority, tags, source
 */
router.post('/',
    validateCreateTicket,
    supportTicketController.createTicket
);

/**
 * @route   PUT /api/support-tickets/:id
 * @desc    Update a support ticket
 * @access  Private
 * @body    subject, description, category, priority, status, assignedTo, tags
 */
router.put('/:id',
    validateUpdateTicket,
    supportTicketController.updateTicket
);

/**
 * @route   POST /api/support-tickets/:id/messages
 * @desc    Add a message to a support ticket
 * @access  Private
 * @body    content, attachments
 */
router.post('/:id/messages',
    validateAddMessage,
    supportTicketController.addMessage
);

/**
 * @route   POST /api/support-tickets/:id/assign
 * @desc    Assign a ticket to an admin (Admin only)
 * @access  Private (Admin)
 * @body    adminId
 */
router.post('/:id/assign',
    validateAssignTicket,
    supportTicketController.assignTicket
);

/**
 * @route   POST /api/support-tickets/:id/close
 * @desc    Close a support ticket (Admin only)
 * @access  Private (Admin)
 */
router.post('/:id/close',
    validateTicketId,
    supportTicketController.closeTicket
);

/**
 * @route   POST /api/support-tickets/:id/rate
 * @desc    Rate ticket satisfaction
 * @access  Private
 * @body    rating, feedback
 */
router.post('/:id/rate',
    validateRateTicket,
    supportTicketController.rateTicket
);

/**
 * @route   DELETE /api/support-tickets/:id
 * @desc    Delete a support ticket (soft delete - Admin only)
 * @access  Private (Admin)
 */
router.delete('/:id',
    validateTicketId,
    supportTicketController.deleteTicket
);

module.exports = router;
