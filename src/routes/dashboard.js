const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// Protect all dashboard routes
router.use(authenticateToken);

// GET /api/dashboard
router.get('/', (req, res) => dashboardController.getOverview(req, res));
// GET /api/dashboard/me - customer-facing summary
router.get('/me', (req, res) => dashboardController.getCustomerOverview(req, res));

module.exports = router;
