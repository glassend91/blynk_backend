const { body, param, query } = require('express-validator');

// Validation for creating a support ticket
const validateCreateTicket = [
    body('subject')
        .notEmpty()
        .withMessage('Subject is required')
        .isLength({ min: 5, max: 200 })
        .withMessage('Subject must be between 5 and 200 characters')
        .trim(),

    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 2000 })
        .withMessage('Description must be between 10 and 2000 characters')
        .trim(),

    body('category')
        .isIn(['Technical', 'Billing', 'Account', 'Service', 'General'])
        .withMessage('Category must be one of: Technical, Billing, Account, Service, General'),

    body('priority')
        .optional()
        .isIn(['Low', 'Medium', 'High', 'Critical'])
        .withMessage('Priority must be one of: Low, Medium, High, Critical'),

    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array')
        .custom((tags) => {
            if (tags && tags.length > 10) {
                throw new Error('Maximum 10 tags allowed');
            }
            return true;
        }),

    body('source')
        .optional()
        .isIn(['Web', 'Email', 'Phone', 'Chat', 'API'])
        .withMessage('Source must be one of: Web, Email, Phone, Chat, API')
];

// Validation for updating a support ticket
const validateUpdateTicket = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ticket ID'),

    body('subject')
        .optional()
        .isLength({ min: 5, max: 200 })
        .withMessage('Subject must be between 5 and 200 characters')
        .trim(),

    body('description')
        .optional()
        .isLength({ min: 10, max: 2000 })
        .withMessage('Description must be between 10 and 2000 characters')
        .trim(),

    body('category')
        .optional()
        .isIn(['Technical', 'Billing', 'Account', 'Service', 'General'])
        .withMessage('Category must be one of: Technical, Billing, Account, Service, General'),

    body('priority')
        .optional()
        .isIn(['Low', 'Medium', 'High', 'Critical'])
        .withMessage('Priority must be one of: Low, Medium, High, Critical'),

    body('status')
        .optional()
        .isIn(['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'])
        .withMessage('Status must be one of: Open, In Progress, Resolved, Closed, Cancelled'),

    body('assignedTo')
        .optional()
        .isMongoId()
        .withMessage('Invalid assigned user ID'),

    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array')
        .custom((tags) => {
            if (tags && tags.length > 10) {
                throw new Error('Maximum 10 tags allowed');
            }
            return true;
        })
];

// Validation for adding a message
const validateAddMessage = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ticket ID'),

    body('content')
        .notEmpty()
        .withMessage('Message content is required')
        .isLength({ min: 1, max: 2000 })
        .withMessage('Message content must be between 1 and 2000 characters')
        .trim(),

    body('attachments')
        .optional()
        .isArray()
        .withMessage('Attachments must be an array')
        .custom((attachments) => {
            if (attachments && attachments.length > 5) {
                throw new Error('Maximum 5 attachments allowed');
            }
            return true;
        })
];

// Validation for ticket ID parameter
const validateTicketId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ticket ID')
];


// Validation for customer ID parameter
const validateCustomerId = [
    param('customerId')
        .isMongoId()
        .withMessage('Invalid customer ID')
];

// Validation for assigning ticket
const validateAssignTicket = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ticket ID'),

    body('adminId')
        .isMongoId()
        .withMessage('Invalid admin ID')
];

// Validation for rating ticket
const validateRateTicket = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ticket ID'),

    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be between 1 and 5'),

    body('feedback')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Feedback must be less than 500 characters')
        .trim()
];

// Validation for query parameters
const validateGetTicketsQuery = [
    query('status')
        .optional()
        .isIn(['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'])
        .withMessage('Invalid status value'),

    query('category')
        .optional()
        .isIn(['Technical', 'Billing', 'Account', 'Service', 'General'])
        .withMessage('Invalid category value'),

    query('priority')
        .optional()
        .isIn(['Low', 'Medium', 'High', 'Critical'])
        .withMessage('Invalid priority value'),

    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

// Validation for search query
const validateSearchQuery = [
    query('q')
        .notEmpty()
        .withMessage('Search query is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Search query must be between 2 and 100 characters')
        .trim(),

    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
];

module.exports = {
    validateCreateTicket,
    validateUpdateTicket,
    validateAddMessage,
    validateTicketId,
    validateCustomerId,
    validateAssignTicket,
    validateRateTicket,
    validateGetTicketsQuery,
    validateSearchQuery
};
