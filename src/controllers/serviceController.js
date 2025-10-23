const Service = require('../models/Service');
const ServiceSubscription = require('../models/ServiceSubscription');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const BillingAccount = require('../models/BillingAccount');
const Invoice = require('../models/Invoice');

class ServiceController {
    // Get all available services
    static async getServices(req, res) {
        try {
            const { serviceType, category, minPrice, maxPrice, search } = req.query;
            const userId = req.user.id;

            // Build query
            const query = { isActive: true, isAvailable: true };

            if (serviceType) {
                query.serviceType = serviceType;
            }

            if (category) {
                query.category = category;
            }

            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = parseFloat(minPrice);
                if (maxPrice) query.price.$lte = parseFloat(maxPrice);
            }

            // Text search
            if (search) {
                query.$text = { $search: search };
            }

            const services = await Service.find(query)
                .populate('providerId', 'firstName lastName email')
                .sort({ createdAt: -1 });

            // Add subscription status for each service
            const servicesWithStatus = await Promise.all(
                services.map(async (service) => {
                    const subscription = await ServiceSubscription.findOne({
                        userId,
                        serviceId: service._id,
                        subscriptionStatus: { $in: ['active', 'pending'] }
                    });

                    const serviceObj = service.toObject();
                    serviceObj.isSubscribed = !!subscription;
                    serviceObj.subscriptionStatus = subscription ? subscription.subscriptionStatus : null;
                    serviceObj.subscriptionId = subscription ? subscription._id : null;

                    return serviceObj;
                })
            );

            res.json({
                services: servicesWithStatus
            });

        } catch (error) {
            console.error('Error fetching services:', error);
            res.status(500).json({
                error: 'Failed to fetch services',
                message: error.message
            });
        }
    }

    // Get service by ID
    static async getServiceById(req, res) {
        try {
            const { serviceId } = req.params;
            const userId = req.user.id;

            const service = await Service.findById(serviceId)
                .populate('providerId', 'firstName lastName email');

            if (!service) {
                return res.status(404).json({
                    error: 'Service not found'
                });
            }

            // Check if user is subscribed
            const subscription = await ServiceSubscription.findOne({
                userId,
                serviceId,
                subscriptionStatus: { $in: ['active', 'pending'] }
            });

            const serviceObj = service.toObject();
            serviceObj.isSubscribed = !!subscription;
            serviceObj.subscriptionStatus = subscription ? subscription.subscriptionStatus : null;
            serviceObj.subscriptionId = subscription ? subscription._id : null;

            res.json({
                service: serviceObj
            });

        } catch (error) {
            console.error('Error fetching service:', error);
            res.status(500).json({
                error: 'Failed to fetch service',
                message: error.message
            });
        }
    }

    // Subscribe to a service
    static async subscribeToService(req, res) {
        try {
            const { serviceId } = req.params;
            const { assignedAddress, assignedNumber, selectedAddOns, paymentMethodId } = req.body;
            const userId = req.user.id;

            // Check if service exists and is available
            const service = await Service.findById(serviceId);
            if (!service || !service.isAvailableForSubscription()) {
                return res.status(400).json({
                    error: 'Service not available for subscription'
                });
            }

            // Check if user already has an active subscription
            const existingSubscription = await ServiceSubscription.findOne({
                userId,
                serviceId,
                subscriptionStatus: { $in: ['active', 'pending'] }
            });

            if (existingSubscription) {
                return res.status(400).json({
                    error: 'User already has an active subscription to this service'
                });
            }

            // Validate payment method if provided
            let paymentMethod = null;
            if (paymentMethodId) {
                paymentMethod = await PaymentMethod.findOne({
                    _id: paymentMethodId,
                    user: userId,
                    isActive: true
                });

                if (!paymentMethod) {
                    return res.status(400).json({
                        error: 'Invalid payment method'
                    });
                }
            }

            // Calculate subscription price
            let totalPrice = service.price;
            const processedAddOns = [];

            if (selectedAddOns && selectedAddOns.length > 0) {
                for (const addOnId of selectedAddOns) {
                    const addOn = service.addOns.find(a => a._id.toString() === addOnId && a.isActive);
                    if (addOn) {
                        totalPrice += addOn.price;
                        processedAddOns.push({
                            addOnId: addOnId,
                            name: addOn.name,
                            price: addOn.price,
                            isActive: true
                        });
                    }
                }
            }

            // Calculate expiry date
            const now = new Date();
            const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

            // Create subscription
            const subscription = new ServiceSubscription({
                serviceId,
                userId,
                subscriptionStatus: 'pending',
                assignedNumber,
                assignedAddress,
                subscriptionPrice: service.price,
                totalPrice,
                currency: service.currency,
                billingCycle: service.billingCycle,
                selectedAddOns: processedAddOns,
                expiresAt,
                nextBillingDate: expiresAt,
                paymentMethodId: paymentMethod ? paymentMethod._id : null,
                paymentStatus: paymentMethod ? 'paid' : 'pending'
            });

            await subscription.save();

            // Increment service subscription count
            await service.incrementSubscriptionCount();

            // Create or update billing account
            let billingAccount = await BillingAccount.findOne({ customerId: userId });
            if (!billingAccount) {
                billingAccount = new BillingAccount({
                    customerId: userId,
                    billingCycle: 'monthly',
                    creditLimit: 1000,
                    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                    autoPayEnabled: !!paymentMethod,
                    defaultPaymentMethod: paymentMethod ? paymentMethod._id : null,
                    status: 'active'
                });
                billingAccount.calculateNextBillingDate();
                await billingAccount.save();
                console.log('✅ Created billing account for user');
            }

            // Generate initial invoice for the subscription
            try {
                const invoiceNumber = await Invoice.generateInvoiceNumber();

                // Validate service data
                if (!service || (!service.name && !service.serviceName) || service.price === undefined) {
                    console.error('Invalid service data for invoice creation:', service);
                    throw new Error('Service data is invalid');
                }

                // Create line items
                const lineItems = [{
                    description: service.name || service.serviceName || 'Service Subscription',
                    quantity: 1,
                    unitPrice: service.price || 0,
                    amount: service.price || 0,
                    serviceId: service._id,
                    subscriptionId: subscription._id
                }];

                // Add add-ons to line items if any
                if (processedAddOns && processedAddOns.length > 0) {
                    processedAddOns.forEach(addOn => {
                        if (addOn && addOn.name && addOn.price !== undefined) {
                            lineItems.push({
                                description: addOn.name,
                                quantity: 1,
                                unitPrice: addOn.price,
                                amount: addOn.price,
                                serviceId: service._id,
                                subscriptionId: subscription._id
                            });
                        }
                    });
                }

                // Calculate totals
                const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
                const discount = 0; // No discount for initial subscription
                const tax = subtotal * 0.10; // 10% GST
                const total = subtotal + tax;

                const invoice = new Invoice({
                    invoiceNumber: invoiceNumber,
                    customerId: userId,
                    billingPeriod: {
                        startDate: new Date(),
                        endDate: expiresAt
                    },
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                    status: paymentMethod ? 'paid' : 'sent',
                    subtotal: subtotal,
                    discount: discount,
                    tax: tax,
                    total: total,
                    currency: service.currency || 'AUD',
                    lineItems: lineItems,
                    paymentMethod: paymentMethod ? paymentMethod._id : null,
                    paymentDate: paymentMethod ? new Date() : null,
                    paymentReference: paymentMethod ? `PAY-${Date.now()}` : null,
                    notes: `Initial subscription invoice for ${service.name || service.serviceName}`
                });

                await invoice.save();
                console.log(`✅ Created invoice ${invoiceNumber} for service subscription: $${total.toFixed(2)}`);
            } catch (invoiceError) {
                console.error('Error creating initial invoice:', invoiceError);
                // Don't fail the subscription if invoice creation fails
            }

            // Populate subscription data
            await subscription.populate([
                { path: 'serviceId' },
                { path: 'paymentMethodId' }
            ]);

            res.status(201).json({
                message: 'Successfully subscribed to service',
                subscription: subscription.toObject(),
                billingAccount: billingAccount ? {
                    id: billingAccount._id,
                    nextBillingDate: billingAccount.nextBillingDate,
                    autoPayEnabled: billingAccount.autoPayEnabled
                } : null
            });

        } catch (error) {
            console.error('Error subscribing to service:', error);
            res.status(500).json({
                error: 'Failed to subscribe to service',
                message: error.message
            });
        }
    }

    // Get user's subscriptions
    static async getUserSubscriptions(req, res) {
        try {
            const userId = req.user.id;
            const { status } = req.query;

            let query = { userId };
            if (status) {
                query.subscriptionStatus = status;
            }

            const subscriptions = await ServiceSubscription.find(query)
                .populate([
                    { path: 'serviceId' },
                    { path: 'paymentMethodId' }
                ])
                .sort({ subscribedAt: -1 });

            res.json({
                subscriptions: subscriptions.map(sub => sub.toObject())
            });

        } catch (error) {
            console.error('Error fetching user subscriptions:', error);
            res.status(500).json({
                error: 'Failed to fetch subscriptions',
                message: error.message
            });
        }
    }

    // Update subscription status
    static async updateSubscriptionStatus(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { status, reason } = req.body;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId
            }).populate('serviceId');

            if (!subscription) {
                return res.status(404).json({
                    error: 'Subscription not found'
                });
            }

            const validStatuses = ['active', 'inactive', 'suspended', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    error: 'Invalid status'
                });
            }

            // Update subscription status
            subscription.subscriptionStatus = status;

            if (status === 'cancelled') {
                subscription.cancelledAt = new Date();
            } else if (status === 'active' && subscription.subscriptionStatus !== 'active') {
                subscription.activatedAt = new Date();
            }

            subscription.addManagementHistory(status, userId, reason || `Status changed to ${status}`);

            await subscription.save();

            // Update service subscription count if cancelled
            if (status === 'cancelled') {
                await subscription.serviceId.decrementSubscriptionCount();
            }

            res.json({
                message: 'Subscription status updated successfully',
                subscription: subscription.toObject()
            });

        } catch (error) {
            console.error('Error updating subscription status:', error);
            res.status(500).json({
                error: 'Failed to update subscription status',
                message: error.message
            });
        }
    }

    // Add add-on to subscription
    static async addAddOn(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { addOnId } = req.body;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId,
                subscriptionStatus: 'active'
            }).populate('serviceId');

            if (!subscription) {
                return res.status(404).json({
                    error: 'Active subscription not found'
                });
            }

            // Find add-on in service
            const addOn = subscription.serviceId.addOns.find(a => a._id.toString() === addOnId && a.isActive);
            if (!addOn) {
                return res.status(400).json({
                    error: 'Add-on not available'
                });
            }

            // Check if add-on already added
            const existingAddOn = subscription.selectedAddOns.find(a => a.addOnId === addOnId && a.isActive);
            if (existingAddOn) {
                return res.status(400).json({
                    error: 'Add-on already added'
                });
            }

            await subscription.addAddOn({
                addOnId,
                name: addOn.name,
                price: addOn.price
            });

            res.json({
                message: 'Add-on added successfully',
                subscription: subscription.toObject()
            });

        } catch (error) {
            console.error('Error adding add-on:', error);
            res.status(500).json({
                error: 'Failed to add add-on',
                message: error.message
            });
        }
    }

    // Remove add-on from subscription
    static async removeAddOn(req, res) {
        try {
            const { subscriptionId, addOnId } = req.params;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId,
                subscriptionStatus: 'active'
            });

            if (!subscription) {
                return res.status(404).json({
                    error: 'Active subscription not found'
                });
            }

            await subscription.removeAddOn(addOnId);

            res.json({
                message: 'Add-on removed successfully',
                subscription: subscription.toObject()
            });

        } catch (error) {
            console.error('Error removing add-on:', error);
            res.status(500).json({
                error: 'Failed to remove add-on',
                message: error.message
            });
        }
    }

    // Update subscription configuration
    static async updateSubscriptionConfig(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { configuration } = req.body;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId
            });

            if (!subscription) {
                return res.status(404).json({
                    error: 'Subscription not found'
                });
            }

            // Update configuration
            if (configuration) {
                subscription.configuration = { ...subscription.configuration, ...configuration };
            }

            await subscription.save();

            res.json({
                message: 'Subscription configuration updated successfully',
                subscription: subscription.toObject()
            });

        } catch (error) {
            console.error('Error updating subscription configuration:', error);
            res.status(500).json({
                error: 'Failed to update subscription configuration',
                message: error.message
            });
        }
    }

    // Cancel subscription
    static async cancelSubscription(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { reason } = req.body;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId,
                subscriptionStatus: 'active'
            }).populate('serviceId');

            if (!subscription) {
                return res.status(404).json({
                    error: 'Active subscription not found'
                });
            }

            await subscription.cancel(reason || 'User requested cancellation');

            res.json({
                message: 'Subscription cancelled successfully',
                subscription: subscription.toObject()
            });

        } catch (error) {
            console.error('Error cancelling subscription:', error);
            res.status(500).json({
                error: 'Failed to cancel subscription',
                message: error.message
            });
        }
    }

    // Get subscription usage
    static async getSubscriptionUsage(req, res) {
        try {
            const { subscriptionId } = req.params;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId
            }).populate('serviceId');

            if (!subscription) {
                return res.status(404).json({
                    error: 'Subscription not found'
                });
            }

            res.json({
                usage: {
                    totalUsed: subscription.usageData.totalUsed,
                    lastUsageUpdate: subscription.usageData.lastUsageUpdate,
                    usageHistory: subscription.usageData.usageHistory,
                    subscription: subscription.toObject()
                }
            });

        } catch (error) {
            console.error('Error fetching subscription usage:', error);
            res.status(500).json({
                error: 'Failed to fetch subscription usage',
                message: error.message
            });
        }
    }

    // Update subscription usage
    static async updateSubscriptionUsage(req, res) {
        try {
            const { subscriptionId } = req.params;
            const { amount, type, note } = req.body;
            const userId = req.user.id;

            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId,
                subscriptionStatus: 'active'
            });

            if (!subscription) {
                return res.status(404).json({
                    error: 'Active subscription not found'
                });
            }

            await subscription.addUsage(amount, type, note);

            res.json({
                message: 'Usage updated successfully',
                subscription: subscription.toObject()
            });

        } catch (error) {
            console.error('Error updating subscription usage:', error);
            res.status(500).json({
                error: 'Failed to update usage',
                message: error.message
            });
        }
    }
}

module.exports = ServiceController;
