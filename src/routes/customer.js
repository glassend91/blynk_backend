const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const mongoose = require('mongoose');
const BillingAccount = require('../models/BillingAccount');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const PaymentMethodController = require('../controllers/paymentMethodController');

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
            billingAccount.currentBalance = (billingAccount.currentBalance || 0) - creditAmount;

            // Log the credit application (metadata)
            if (!billingAccount.metadata) {
                billingAccount.metadata = {};
            }
            if (!billingAccount.metadata.credits) {
                billingAccount.metadata.credits = [];
            }
            
            const creditId = new mongoose.Types.ObjectId();
            billingAccount.metadata.credits.push({
                id: creditId,
                amount: creditAmount,
                reasonCode: reasonCode || 'manual',
                appliedBy: req.user.id,
                appliedAt: new Date(),
            });

            // Mark the metadata as modified since it's a mixed type
            billingAccount.markModified('metadata');
            await billingAccount.save();

            res.status(200).json({
                success: true,
                message: `Credit of $${creditAmount.toFixed(2)} applied successfully`,
                data: {
                    customerId,
                    creditId,
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

/**
 * @route   POST /api/v1/customer/remove-credit
 * @desc    Remove an applied credit from a customer's billing account
 * @access  Private (Admin with billing.credits_refunds permission)
 * @body    customerId, creditId
 */
router.post(
    '/remove-credit',
    requirePermission('billing.credits_refunds'),
    [
        body('customerId').isMongoId().withMessage('Valid customer ID is required'),
        body('creditId').notEmpty().withMessage('Credit ID is required')
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

            const { customerId, creditId } = req.body;

            // Find billing account
            const billingAccount = await BillingAccount.findOne({ customerId });
            if (!billingAccount || !billingAccount.metadata || !billingAccount.metadata.credits) {
                return res.status(404).json({
                    success: false,
                    message: 'Billing account or credits not found'
                });
            }

            // Find the credit to remove
            const creditIndex = billingAccount.metadata.credits.findIndex(
                (c) => c.id && c.id.toString() === creditId.toString()
            );

            if (creditIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Credit entry not found'
                });
            }

            const credit = billingAccount.metadata.credits[creditIndex];
            
            // Reverse the credit (add back to balance)
            billingAccount.currentBalance = (billingAccount.currentBalance || 0) + credit.amount;

            // Log removal in metadata (optional: could keep a history of removals)
            if (!billingAccount.metadata.removedCredits) {
                billingAccount.metadata.removedCredits = [];
            }
            billingAccount.metadata.removedCredits.push({
                ...credit,
                removedBy: req.user.id,
                removedAt: new Date()
            });

            // Remove from active credits
            billingAccount.metadata.credits.splice(creditIndex, 1);

            billingAccount.markModified('metadata');
            await billingAccount.save();

            res.status(200).json({
                success: true,
                message: `Credit of $${credit.amount.toFixed(2)} removed successfully`,
                data: {
                    customerId,
                    newBalance: billingAccount.currentBalance
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/v1/customer/:customerId/payment-methods
 * @desc    Get all payment methods for a customer (Admin)
 * @access  Private (Admin with can_manage_customer_payment_details permission)
 */
router.get(
    '/:customerId/payment-methods',
    requirePermission('can_manage_customer_payment_details'),
    async (req, res, next) => {
        try {
            const { customerId } = req.params;

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            const paymentMethods = await PaymentMethod.getActiveForUser(customerId);

            res.json({
                success: true,
                data: {
                    customerId,
                    paymentMethods: paymentMethods.map(pm => pm.toSafeJSON())
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/v1/customer/:customerId/payment-methods
 * @desc    Add a new payment method for a customer (Admin)
 * @access  Private (Admin with can_manage_customer_payment_details permission)
 * @body    paymentMethodId, billingDetails
 */
router.post(
    '/:customerId/payment-methods',
    requirePermission('can_manage_customer_payment_details'),
    [
        body('paymentMethodId')
            .notEmpty()
            .withMessage('Payment method ID is required'),
        body('billingDetails.name')
            .optional()
            .isString()
            .withMessage('Billing name must be a string'),
        body('billingDetails.email')
            .optional()
            .isEmail()
            .withMessage('Billing email must be a valid email'),
        body('billingDetails.phone')
            .optional()
            .isString()
            .withMessage('Billing phone must be a string')
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

            const { customerId } = req.params;
            const { paymentMethodId, billingDetails } = req.body;

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            // Temporarily override req.user.id for the payment method controller
            const originalUserId = req.user.id;
            req.user.id = customerId;

            try {
                // Use the existing payment method controller logic
                await PaymentMethodController.createPaymentMethod(req, res, next);
            } finally {
                // Restore original user ID
                req.user.id = originalUserId;
            }
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   PUT /api/v1/customer/:customerId/payment-methods/:paymentMethodId/default
 * @desc    Set a payment method as default for a customer (Admin)
 * @access  Private (Admin with can_manage_customer_payment_details permission)
 */
router.put(
    '/:customerId/payment-methods/:paymentMethodId/default',
    requirePermission('can_manage_customer_payment_details'),
    async (req, res, next) => {
        try {
            const { customerId, paymentMethodId } = req.params;

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            // Find the payment method
            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                user: customerId,
                isActive: true
            });

            if (!paymentMethod) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment method not found'
                });
            }

            // Update the payment method to be default
            paymentMethod.isDefault = true;
            await paymentMethod.save();

            res.json({
                success: true,
                message: 'Default payment method updated successfully',
                data: {
                    customerId,
                    paymentMethod: paymentMethod.toSafeJSON()
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   DELETE /api/v1/customer/:customerId/payment-methods/:paymentMethodId
 * @desc    Delete a payment method for a customer (Admin)
 * @access  Private (Admin with can_manage_customer_payment_details permission)
 */
router.delete(
    '/:customerId/payment-methods/:paymentMethodId',
    requirePermission('can_manage_customer_payment_details'),
    async (req, res, next) => {
        try {
            const { customerId, paymentMethodId } = req.params;

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            // Find the payment method
            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                user: customerId,
                isActive: true
            });

            if (!paymentMethod) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment method not found'
                });
            }

            // Temporarily override req.user.id for the payment method controller
            const originalUserId = req.user.id;
            req.user.id = customerId;

            try {
                // Use the existing payment method controller logic
                req.params.paymentMethodId = paymentMethodId;
                await PaymentMethodController.deletePaymentMethod(req, res, next);
            } finally {
                // Restore original user ID
                req.user.id = originalUserId;
            }
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/v1/customer/:customerId/payment-methods/setup-intent
 * @desc    Create setup intent for adding payment methods for a customer (Admin)
 * @access  Private (Admin with can_manage_customer_payment_details permission)
 */
router.post(
    '/:customerId/payment-methods/setup-intent',
    requirePermission('can_manage_customer_payment_details'),
    async (req, res, next) => {
        try {
            const { customerId } = req.params;

            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer') {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            // Temporarily override req.user.id for the payment method controller
            const originalUserId = req.user.id;
            req.user.id = customerId;

            try {
                // Use the existing payment method controller logic
                await PaymentMethodController.createSetupIntent(req, res, next);
            } finally {
                // Restore original user ID
                req.user.id = originalUserId;
            }
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
