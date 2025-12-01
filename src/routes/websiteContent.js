const express = require('express');
const router = express.Router();
const websiteContentController = require('../controllers/websiteContentController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/website-content
 * @desc    Get all website content pages
 * @access  Private (Admin)
 */
router.get('/', websiteContentController.getAllPages);

/**
 * @route   GET /api/website-content/:pageKey
 * @desc    Get content for a specific page
 * @access  Private (Admin)
 */
router.get('/:pageKey', websiteContentController.getPageContent);

/**
 * @route   PUT /api/website-content/:pageKey
 * @desc    Create or update entire page content
 * @access  Private (Admin)
 * @body    hero, features, seo
 */
router.put('/:pageKey', websiteContentController.upsertPageContent);

/**
 * @route   PATCH /api/website-content/:pageKey/:blockType
 * @desc    Update specific block (hero, features, or seo) for a page
 * @access  Private (Admin)
 * @body    block data (hero, features, or seo object)
 */
router.patch('/:pageKey/:blockType', websiteContentController.updateBlock);

/**
 * @route   DELETE /api/website-content/:pageKey
 * @desc    Delete page content
 * @access  Private (Admin)
 */
router.delete('/:pageKey', websiteContentController.deletePageContent);

module.exports = router;

