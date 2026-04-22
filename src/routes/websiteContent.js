const express = require('express');
const router = express.Router();
const websiteContentController = require('../controllers/websiteContentController');

// Middleware to check authentication
const { authenticateToken } = require('../middleware/auth');

// Public routes (No authentication required to VIEW content)
router.get('/', websiteContentController.getAllPages);
router.get('/:pageKey', websiteContentController.getPageContent);

// Protected routes (Authentication required to EDIT content)
router.use(authenticateToken);

router.put('/:pageKey', websiteContentController.upsertPageContent);
router.patch('/:pageKey/:blockType', websiteContentController.updateBlock);
router.delete('/:pageKey', websiteContentController.deletePageContent);

module.exports = router;

