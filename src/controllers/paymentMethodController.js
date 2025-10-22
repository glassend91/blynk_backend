const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');
const stripe = require('../config/stripe');

class PaymentMethodController {
    // Create a new payment method
    static async createPaymentMethod(req, res) {
        try {
            const { paymentMethodId, billingDetails } = req.body;
            const userId = req.user.id;

            if (!paymentMethodId) {
                return res.status(400).json({
                    error: 'Payment method ID is required'
                });
            }

            // Retrieve the payment method from Stripe
            const stripePaymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

            if (!stripePaymentMethod) {
                return res.status(400).json({
                    error: 'Invalid payment method'
                });
            }

            // Get or create Stripe customer
            let user = await User.findById(userId);
            let stripeCustomerId = user.stripeCustomerId;

            if (!stripeCustomerId) {
                const stripeCustomer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    metadata: {
                        userId: userId.toString()
                    }
                });
                stripeCustomerId = stripeCustomer.id;

                // Update user with Stripe customer ID
                await User.findByIdAndUpdate(userId, { stripeCustomerId });
            }

            // Attach payment method to customer
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: stripeCustomerId
            });

            // Check if this is the first payment method (make it default)
            const existingPaymentMethods = await PaymentMethod.countDocuments({
                user: userId,
                isActive: true
            });

            const isDefault = existingPaymentMethods === 0;

            // Create payment method record
            const paymentMethodData = {
                user: userId,
                stripePaymentMethodId: paymentMethodId,
                stripeCustomerId,
                type: stripePaymentMethod.type,
                isDefault,
                billingDetails: billingDetails || {}
            };

            // Add card details if it's a card
            if (stripePaymentMethod.type === 'card') {
                paymentMethodData.card = {
                    brand: stripePaymentMethod.card.brand,
                    last4: stripePaymentMethod.card.last4,
                    expMonth: stripePaymentMethod.card.exp_month,
                    expYear: stripePaymentMethod.card.exp_year,
                    funding: stripePaymentMethod.card.funding,
                    country: stripePaymentMethod.card.country,
                    cvcCheck: stripePaymentMethod.card.checks?.cvc_check,
                    addressLine1Check: stripePaymentMethod.card.checks?.address_line1_check,
                    addressPostalCodeCheck: stripePaymentMethod.card.checks?.address_postal_code_check
                };
            }

            // Add bank account details if it's a bank account
            if (stripePaymentMethod.type === 'bank_account') {
                paymentMethodData.bankAccount = {
                    bankName: stripePaymentMethod.bank_account?.bank_name,
                    last4: stripePaymentMethod.bank_account?.last4,
                    routingNumber: stripePaymentMethod.bank_account?.routing_number,
                    accountType: stripePaymentMethod.bank_account?.account_type,
                    country: stripePaymentMethod.bank_account?.country
                };
            }

            const paymentMethod = new PaymentMethod(paymentMethodData);
            await paymentMethod.save();

            res.status(201).json({
                message: 'Payment method added successfully',
                paymentMethod: paymentMethod.toSafeJSON()
            });

        } catch (error) {
            console.error('Error creating payment method:', error);

            if (error.type === 'StripeCardError') {
                return res.status(400).json({
                    error: 'Card error',
                    message: error.message
                });
            } else if (error.type === 'StripeInvalidRequestError') {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: error.message
                });
            }

            res.status(500).json({
                error: 'Failed to create payment method',
                message: error.message
            });
        }
    }

    // Get all payment methods for a user
    static async getPaymentMethods(req, res) {
        try {
            const userId = req.user.id;
            const paymentMethods = await PaymentMethod.getActiveForUser(userId);

            res.json({
                paymentMethods: paymentMethods.map(pm => pm.toSafeJSON())
            });

        } catch (error) {
            console.error('Error fetching payment methods:', error);
            res.status(500).json({
                error: 'Failed to fetch payment methods',
                message: error.message
            });
        }
    }

    // Get default payment method
    static async getDefaultPaymentMethod(req, res) {
        try {
            const userId = req.user.id;
            const defaultPaymentMethod = await PaymentMethod.getDefaultForUser(userId);

            if (!defaultPaymentMethod) {
                return res.status(404).json({
                    error: 'No default payment method found'
                });
            }

            res.json({
                paymentMethod: defaultPaymentMethod.toSafeJSON()
            });

        } catch (error) {
            console.error('Error fetching default payment method:', error);
            res.status(500).json({
                error: 'Failed to fetch default payment method',
                message: error.message
            });
        }
    }

    // Set default payment method
    static async setDefaultPaymentMethod(req, res) {
        try {
            const { paymentMethodId } = req.params;
            const userId = req.user.id;

            // Find the payment method
            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                user: userId,
                isActive: true
            });

            if (!paymentMethod) {
                return res.status(404).json({
                    error: 'Payment method not found'
                });
            }

            // Update the payment method to be default
            paymentMethod.isDefault = true;
            await paymentMethod.save();

            res.json({
                message: 'Default payment method updated successfully',
                paymentMethod: paymentMethod.toSafeJSON()
            });

        } catch (error) {
            console.error('Error setting default payment method:', error);
            res.status(500).json({
                error: 'Failed to set default payment method',
                message: error.message
            });
        }
    }

    // Update payment method billing details
    static async updatePaymentMethod(req, res) {
        try {
            const { paymentMethodId } = req.params;
            const { billingDetails } = req.body;
            const userId = req.user.id;

            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                user: userId,
                isActive: true
            });

            if (!paymentMethod) {
                return res.status(404).json({
                    error: 'Payment method not found'
                });
            }

            // Update billing details in Stripe
            if (billingDetails) {
                await stripe.paymentMethods.update(paymentMethod.stripePaymentMethodId, {
                    billing_details: billingDetails
                });

                // Update local record
                paymentMethod.billingDetails = { ...paymentMethod.billingDetails, ...billingDetails };
                await paymentMethod.save();
            }

            res.json({
                message: 'Payment method updated successfully',
                paymentMethod: paymentMethod.toSafeJSON()
            });

        } catch (error) {
            console.error('Error updating payment method:', error);
            res.status(500).json({
                error: 'Failed to update payment method',
                message: error.message
            });
        }
    }

    // Delete payment method
    static async deletePaymentMethod(req, res) {
        try {
            const { paymentMethodId } = req.params;
            const userId = req.user.id;

            const paymentMethod = await PaymentMethod.findOne({
                _id: paymentMethodId,
                user: userId,
                isActive: true
            });

            if (!paymentMethod) {
                return res.status(404).json({
                    error: 'Payment method not found'
                });
            }

            // Detach from Stripe customer
            try {
                await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
            } catch (stripeError) {
                console.warn('Failed to detach payment method from Stripe:', stripeError.message);
                // Continue with local deletion even if Stripe detach fails
            }

            // Soft delete the payment method
            paymentMethod.isActive = false;
            paymentMethod.isDefault = false;
            await paymentMethod.save();

            // If this was the default, set another payment method as default
            const remainingPaymentMethods = await PaymentMethod.find({
                user: userId,
                isActive: true,
                _id: { $ne: paymentMethodId }
            }).sort({ createdAt: 1 });

            if (remainingPaymentMethods.length > 0) {
                remainingPaymentMethods[0].isDefault = true;
                await remainingPaymentMethods[0].save();
            }

            res.json({
                message: 'Payment method deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting payment method:', error);
            res.status(500).json({
                error: 'Failed to delete payment method',
                message: error.message
            });
        }
    }

    // Create setup intent for adding payment methods
    static async createSetupIntent(req, res) {
        try {
            const userId = req.user.id;

            // Get or create Stripe customer
            let user = await User.findById(userId);
            let stripeCustomerId = user.stripeCustomerId;

            if (!stripeCustomerId) {
                const stripeCustomer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    metadata: {
                        userId: userId.toString()
                    }
                });
                stripeCustomerId = stripeCustomer.id;

                // Update user with Stripe customer ID
                await User.findByIdAndUpdate(userId, { stripeCustomerId });
            }

            // Create setup intent
            const setupIntent = await stripe.setupIntents.create({
                customer: stripeCustomerId,
                payment_method_types: ['card'],
                usage: 'off_session'
            });

            res.json({
                clientSecret: setupIntent.client_secret,
                id: setupIntent.id
            });

        } catch (error) {
            console.error('Error creating setup intent:', error);
            res.status(500).json({
                error: 'Failed to create setup intent',
                message: error.message
            });
        }
    }

    // Get auto-pay settings
    static async getAutoPaySettings(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

            res.json({
                autoPayEnabled: user.autoPayEnabled || false,
                emailNotifications: user.emailNotifications || true,
                billingNotifications: user.billingNotifications || true
            });

        } catch (error) {
            console.error('Error fetching auto-pay settings:', error);
            res.status(500).json({
                error: 'Failed to fetch auto-pay settings',
                message: error.message
            });
        }
    }

    // Update auto-pay settings
    static async updateAutoPaySettings(req, res) {
        try {
            const { autoPayEnabled, emailNotifications, billingNotifications } = req.body;
            const userId = req.user.id;

            const updateData = {};
            if (autoPayEnabled !== undefined) updateData.autoPayEnabled = autoPayEnabled;
            if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
            if (billingNotifications !== undefined) updateData.billingNotifications = billingNotifications;

            await User.findByIdAndUpdate(userId, updateData);

            res.json({
                message: 'Auto-pay settings updated successfully',
                settings: {
                    autoPayEnabled: autoPayEnabled,
                    emailNotifications: emailNotifications,
                    billingNotifications: billingNotifications
                }
            });

        } catch (error) {
            console.error('Error updating auto-pay settings:', error);
            res.status(500).json({
                error: 'Failed to update auto-pay settings',
                message: error.message
            });
        }
    }
}

module.exports = PaymentMethodController;
