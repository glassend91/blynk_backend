const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/testimonials
 * @desc    Get all testimonials with optional filtering
 * @access  Private (Admin)
 * @query   published, search
 */
router.get('/', testimonialController.getAllTestimonials);

/**
 * @route   GET /api/testimonials/:id
 * @desc    Get testimonial by ID
 * @access  Private (Admin)
 */
router.get('/:id', testimonialController.getTestimonialById);

/**
 * @route   POST /api/testimonials
 * @desc    Create a new testimonial
 * @access  Private (Admin)
 * @body    name, location, plan, rating, avatarUrl, quote, published
 */
router.post('/', testimonialController.createTestimonial);

/**
 * @route   PUT /api/testimonials/:id
 * @desc    Update a testimonial
 * @access  Private (Admin)
 * @body    name, location, plan, rating, avatarUrl, quote, published
 */
router.put('/:id', testimonialController.updateTestimonial);

/**
 * @route   DELETE /api/testimonials/:id
 * @desc    Delete a testimonial
 * @access  Private (Admin)
 */
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router;

