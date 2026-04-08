const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Protect all role routes and require admin access
router.use(authenticateToken, requireAdmin);

// GET /api/roles
router.get('/', (req, res) => roleController.listRoles(req, res));

// POST /api/roles
router.post('/', (req, res) => roleController.createRole(req, res));

// PUT /api/roles/:id
router.put('/:id', (req, res) => roleController.updateRole(req, res));

// DELETE /api/roles/:id
router.delete('/:id', (req, res) => roleController.deleteRole(req, res));

module.exports = router;


