const express = require('express');
const router = express.Router();
const wholesalerPlanController = require('../controllers/wholesalerPlanController');

// GET all wholesaler plans
router.get('/', wholesalerPlanController.getAllPlans);

// POST create manual plan (NBN)
router.post('/', wholesalerPlanController.createPlan);

// POST sync from wholesaler API
router.post('/sync', wholesalerPlanController.syncPlans);

// PUT update a single plan (custom_name, price)
router.put('/:id', wholesalerPlanController.updatePlan);

module.exports = router;
