const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const BillingAccount = require('../models/BillingAccount');
const User = require('../models/User');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/v1/customer/credit
 * @desc    Apply credit to a customer's billing account
 * @access  Private (Admin with billing.credits_refunds permission)
 * @body    customerId, amount, reasonCode
 */
router.post(
    '/credit',
    requirePermission('billing.credits_refunds'),
    [
        body('customerId').isMongoId().withMessage('Valid customer ID is required'),
        body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
        body('reasonCode').optional().isString().trim()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { customerId, amount, reasonCode } = req.body;

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            // Get or create billing account
            let billingAccount = await BillingAccount.findOne({ customerId });
            if (!billingAccount) {
                billingAccount = new BillingAccount({
                    customerId,
                    currentBalance: 0,
                    creditLimit: 0,
                    billingCycle: 'monthly',
                    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    autoPayEnabled: customer.autoPayEnabled || false,
                });
                billingAccount.calculateNextBillingDate();
            }

            // Apply credit (reduce balance)
            const creditAmount = parseFloat(amount);
            billingAccount.currentBalance = Math.max(0, (billingAccount.currentBalance || 0) - creditAmount);

            await billingAccount.save();

            // Log the credit application (metadata)
            if (!billingAccount.metadata) {
                billingAccount.metadata = {};
            }
            if (!billingAccount.metadata.credits) {
                billingAccount.metadata.credits = [];
            }
            billingAccount.metadata.credits.push({
                amount: creditAmount,
                reasonCode: reasonCode || 'manual',
                appliedBy: req.user.id,
                appliedAt: new Date(),
            });
            await billingAccount.save();

            res.status(200).json({
                success: true,
                message: `Credit of $${creditAmount.toFixed(2)} applied successfully`,
                data: {
                    customerId,
                    creditAmount,
                    newBalance: billingAccount.currentBalance,
                    reasonCode: reasonCode || 'manual'
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
