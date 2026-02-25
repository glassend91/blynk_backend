const Service = require('../models/Service');
const ServiceSubscription = require('../models/ServiceSubscription');
const User = require('../models/User');
const Role = require('../models/Role');
const PaymentMethod = require('../models/PaymentMethod');
const BillingAccount = require('../models/BillingAccount');
const Invoice = require('../models/Invoice');
const wholesalerService = require('../services/wholesalerService');

const BILLING_LABELS = {
    monthly: 'Month',
    quarterly: 'Quarter',
    yearly: 'Year',
};

const SUPPORTED_SERVICE_TYPES = ['NBN', 'Business NBN', 'Mobile', 'Data Only', 'Voice Only'];

function formatPriceDisplay(service) {
    const currency = service.currency || 'AUD';
    const price = Number(service.price || 0);
    const formatter = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    });
    const cycle = BILLING_LABELS[service.billingCycle] || service.billingCycle || 'Month';
    return `${formatter.format(price)}/${cycle}`;
}

function determineSpeedOrData(service) {
    const specs = service.specifications || {};
    if (service.serviceType === 'NBN' || service.serviceType === 'Business NBN') {
        if (specs.downloadSpeed && specs.uploadSpeed) {
            return `${specs.downloadSpeed}/${specs.uploadSpeed} Mbps`;
        }
        if (specs.downloadSpeed) return `${specs.downloadSpeed} Mbps`;
        return specs.dataAllowance || 'NBN Plan';
    }
    if (service.serviceType === 'Mobile') {
        return specs.dataAllowance || specs.network || '4G/5G';
    }
    if (service.serviceType === 'Data Only') {
        return specs.dataAllowance || 'Data Only';
    }
    if (service.serviceType === 'Voice Only') {
        if (specs.voiceMinutes || specs.smsMessages) {
            return `${specs.voiceMinutes || 'Unlimited'} mins / ${specs.smsMessages || 'Unlimited'} SMS`;
        }
        return 'Voice Plan';
    }
    return specs.dataAllowance || 'Plan';
}

function buildSpecifications(serviceType, speedOrData, staticIP, slaDetails) {
    const specs = {};
    if (!speedOrData && staticIP === undefined && !slaDetails) return specs;

    if (speedOrData) {
        const value = String(speedOrData).trim();
        if (value) {
            if (serviceType === 'NBN' || serviceType === 'Business NBN') {
                const sanitized = value.replace(/mbps/gi, '').trim();
                const [downloadStr, uploadStr] = sanitized.split('/');
                const downloadSpeed = downloadStr ? parseInt(downloadStr, 10) : NaN;
                const uploadSpeed = uploadStr ? parseInt(uploadStr, 10) : NaN;
                if (!Number.isNaN(downloadSpeed)) specs.downloadSpeed = downloadSpeed;
                if (!Number.isNaN(uploadSpeed)) specs.uploadSpeed = uploadSpeed;
                if (Number.isNaN(downloadSpeed) && Number.isNaN(uploadSpeed)) {
                    specs.dataAllowance = value;
                }
            } else if (serviceType === 'Mobile' || serviceType === 'Data Only') {
                specs.dataAllowance = value;
            } else if (serviceType === 'Voice Only') {
                specs.voiceMinutes = value;
            } else {
                specs.dataAllowance = value;
            }
        }
    }

    // Add business-specific fields for Business NBN
    if (serviceType === 'Business NBN') {
        if (staticIP !== undefined) specs.staticIP = staticIP;
        if (slaDetails) specs.slaDetails = slaDetails;
    }

    return specs;
}

function mapFeaturesPayload(features) {
    if (!Array.isArray(features)) return [];
    return features
        .map((feature) => (typeof feature === 'string' ? feature.trim() : ''))
        .filter(Boolean)
        .map((name) => ({
            name,
            description: '',
            isIncluded: true,
        }));
}

function mapServiceToAdminRow(service, index) {
    // Map visibilityStatus to display status
    let displayStatus = 'Published';
    if (service.visibilityStatus === 'internal') {
        displayStatus = 'Staff-Only';
    } else if (service.visibilityStatus === 'hidden') {
        displayStatus = 'Hidden';
    } else if (!service.isActive) {
        displayStatus = 'Draft';
    }

    return {
        id: index + 1,
        serviceId: service._id.toString(),
        name: service.serviceName,
        details: service.description || 'No description provided',
        type: service.serviceType === 'Data Only' || service.serviceType === 'Voice Only' || service.serviceType === 'Business NBN'
            ? service.serviceType
            : (service.serviceType === 'Mobile' ? 'Mobile' : 'NBN'),
        speedOrData: determineSpeedOrData(service),
        price: formatPriceDisplay(service),
        status: displayStatus,
        visibilityStatus: service.visibilityStatus || (service.isActive ? 'public' : 'hidden'),
        customers: service.totalSubscriptions || 0,
    };
}

class ServiceController {
    // Get all available services (customer-facing - excludes internal plans)
    static async getServices(req, res) {
        try {
            console.log('Fetching services with query:', req.query);
            const { serviceType, category, minPrice, maxPrice, search } = req.query;
            const userId = req.user.id;

            // Build query - exclude internal plans for customer-facing endpoint
            const query = {
                visibilityStatus: 'public',
                isActive: true,
                isAvailable: true,
                isDeleted: { $ne: true }
            };

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

    // Public services endpoint for unauthenticated flows (e.g., signup)
    static async getPublicServices(req, res) {
        try {
            console.log('Fetching public services with query:', req.query);
            const { serviceType, category, minPrice, maxPrice, search } = req.query;

            const query = {
                visibilityStatus: 'public',
                isActive: true,
                isAvailable: true,
                isDeleted: { $ne: true }
            };

            if (serviceType) query.serviceType = serviceType;
            if (category) query.category = category;
            if (minPrice || maxPrice) {
                query.price = {};
                if (minPrice) query.price.$gte = parseFloat(minPrice);
                if (maxPrice) query.price.$lte = parseFloat(maxPrice);
            }
            if (search) query.$text = { $search: search };

            const services = await Service.find(query)
                .populate('providerId', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .lean();

            // Map to a lightweight DTO that the signup UI expects
            const mapped = services.map(s => ({
                _id: s._id,
                serviceName: s.serviceName,
                serviceType: s.serviceType,
                price: s.price,
                currency: s.currency,
                billingCycle: s.billingCycle,
                features: s.features || [],
                specifications: s.specifications || {}
            }));

            // Return array directly for frontend convenience
            return res.json(mapped);
        } catch (error) {
            console.error('Error fetching public services:', error);
            return res.status(500).json({ error: 'Failed to fetch public services', message: error.message });
        }
    }

    // Admin: Get service by ID for editing
    static async getServiceForAdmin(req, res) {
        try {
            const { serviceId } = req.params;

            const service = await Service.findById(serviceId)
                .populate('providerId', 'firstName lastName email');

            if (!service || service.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            // Format features for frontend
            const featuresList = service.features?.map(f => f.name).join('\n') || '';

            res.json({
                success: true,
                service: {
                    ...service.toObject(),
                    features: featuresList,
                }
            });
        } catch (error) {
            console.error('Error fetching service for admin:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch service',
            });
        }
    }

    // Admin listing for services (used by admin dashboard)
    static async getServicesForAdmin(req, res) {
        try {
            const services = await Service.find({ isDeleted: { $ne: true } })
                .sort({ createdAt: -1 });

            const mapped = services.map(mapServiceToAdminRow);

            res.json({
                success: true,
                services: mapped,
            });
        } catch (error) {
            console.error('Error fetching admin services:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch services',
            });
        }
    }

    static async createService(req, res) {
        try {
            // Check if user has permission to create plans
            // SuperAdmin bypasses permission checks
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasCreatePermission = roleDoc.permissions['plans.create'] === true;
                        if (!hasCreatePermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to create plans'
                            });
                        }
                    }
                }
            }

            const {
                serviceName,
                serviceType,
                price,
                billingCycle = 'monthly',
                currency = 'AUD',
                status = 'Published',
                description,
                speedOrData,
                features = [],
                staticIP,
                slaDetails,
            } = req.body;

            if (!SUPPORTED_SERVICE_TYPES.includes(serviceType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Unsupported service type',
                });
            }

            const providerId = req.user?.id;
            if (!providerId) {
                return res.status(403).json({
                    success: false,
                    message: 'Provider context missing',
                });
            }

            const numericPrice = Number(price);
            if (Number.isNaN(numericPrice)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid price value',
                });
            }

            // Map status to visibilityStatus
            let visibilityStatus = 'public';
            let isActive = true;
            if (status === 'Staff-Only') {
                visibilityStatus = 'internal';
                isActive = true;
            } else if (status === 'Hidden') {
                visibilityStatus = 'hidden';
                isActive = true;
            } else if (status === 'Draft') {
                visibilityStatus = 'public';
                isActive = false;
            }

            const service = await Service.create({
                serviceName: serviceName.trim(),
                serviceType,
                description: description ? description.trim() : '',
                price: numericPrice,
                currency,
                billingCycle,
                providerId,
                specifications: buildSpecifications(serviceType, speedOrData, staticIP, slaDetails),
                features: mapFeaturesPayload(features),
                visibilityStatus,
                isActive,
                isAvailable: true,
            });

            const mapped = mapServiceToAdminRow(service, 0);
            res.status(201).json({
                success: true,
                service: mapped,
            });
        } catch (error) {
            console.error('Error creating service:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create service',
            });
        }
    }

    // Get service by ID (customer-facing - excludes internal plans)
    static async getServiceById(req, res) {
        try {
            const { serviceId } = req.params;
            const userId = req.user.id;

            const service = await Service.findOne({
                _id: serviceId,
                visibilityStatus: 'public',
                isDeleted: { $ne: true }
            })
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

            // Check if service exists and is available (exclude internal plans for customer subscriptions)
            const service = await Service.findOne({
                _id: serviceId,
                visibilityStatus: 'public',
                isDeleted: { $ne: true }
            });
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

    /**
     * Public: Get NBN address autocomplete suggestions from wholesaler
     */
    static async getWholesalerAddressAutocomplete(req, res) {
        try {
            const { query } = req.query;
            if (!query) {
                return res.json({ success: true, data: { addresses: [] } });
            }

            const result = await wholesalerService.getAddressAutocomplete(query);
            if (result.success) {
                return res.json(result.data);
            } else {
                return res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error fetching wholesaler address autocomplete:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Public: Perform NBN availability check (Search + SQ)
     */
    static async getNbnAvailability(req, res) {
        try {
            const { address } = req.body;
            if (!address) {
                return res.status(400).json({ success: false, message: 'Address is required' });
            }

            console.log(`[NBN AVAILABILITY] Checking availability for: ${address}`);

            // 1. Search for address to get locId
            const searchResult = await wholesalerService.searchNbnAddress(address);
            if (!searchResult.success) {
                return res.status(500).json(searchResult);
            }

            const locations = searchResult.data?.locations || [];
            if (locations.length === 0) {
                return res.status(404).json({ success: false, message: 'Location not found' });
            }

            const locId = locations[0].locId;
            if (!locId) {
                return res.status(500).json({ success: false, message: 'Could not retrieve Location ID' });
            }

            // 2. Perform SQ using locId
            const sqResult = await wholesalerService.getNbnServiceQualification(locId);
            if (!sqResult.success) {
                return res.status(500).json(sqResult);
            }

            return res.json({
                success: true,
                locId,
                location: locations[0],
                ...sqResult.data
            });

        } catch (error) {
            console.error('Error in NBN availability check:', error);
            return res.status(500).json({ success: false, message: error.message });
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

    // Admin: Update service plan
    static async updateService(req, res) {
        try {
            // Check permission
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasPermission = roleDoc.permissions['plans.create'] === true;
                        if (!hasPermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to update plans'
                            });
                        }
                    }
                }
            }

            const { serviceId } = req.params;
            const {
                serviceName,
                serviceType,
                price,
                billingCycle = 'monthly',
                currency = 'AUD',
                status = 'Published',
                description,
                speedOrData,
                features = [],
                staticIP,
                slaDetails,
            } = req.body;

            const service = await Service.findById(serviceId);
            if (!service || service.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            if (!SUPPORTED_SERVICE_TYPES.includes(serviceType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Unsupported service type',
                });
            }

            const numericPrice = Number(price);
            if (Number.isNaN(numericPrice) || numericPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid price value',
                });
            }

            // Map status to visibilityStatus
            let visibilityStatus = 'public';
            let isActive = true;
            if (status === 'Staff-Only') {
                visibilityStatus = 'internal';
                isActive = true;
            } else if (status === 'Hidden') {
                visibilityStatus = 'hidden';
                isActive = true;
            } else if (status === 'Draft') {
                visibilityStatus = 'public';
                isActive = false;
            }

            // Update service fields
            service.serviceName = serviceName.trim();
            service.serviceType = serviceType;
            service.description = description ? description.trim() : '';
            service.price = numericPrice;
            service.currency = currency;
            service.billingCycle = billingCycle;
            service.specifications = buildSpecifications(serviceType, speedOrData, staticIP, slaDetails);
            service.features = mapFeaturesPayload(features);
            service.visibilityStatus = visibilityStatus;
            service.isActive = isActive;

            await service.save();

            const mapped = mapServiceToAdminRow(service, 0);
            res.json({
                success: true,
                service: mapped,
            });
        } catch (error) {
            console.error('Error updating service:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update service',
            });
        }
    }

    // Admin: Toggle service active status (hide/show)
    static async toggleServiceActive(req, res) {
        try {
            // Check permission
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasPermission = roleDoc.permissions['plans.create'] === true;
                        if (!hasPermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to update plans'
                            });
                        }
                    }
                }
            }

            const { serviceId } = req.params;
            const { isActive } = req.body;

            if (typeof isActive !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'isActive must be a boolean'
                });
            }

            const service = await Service.findById(serviceId);
            if (!service || service.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            service.isActive = isActive;
            await service.save();

            const mapped = mapServiceToAdminRow(service, 0);
            res.json({
                success: true,
                service: mapped,
            });
        } catch (error) {
            console.error('Error toggling service active status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update service status',
            });
        }
    }

    // Admin: Delete service (soft delete)
    static async deleteService(req, res) {
        try {
            // Check permission
            if (req.user.role !== 'superAdmin') {
                const currentUser = await User.findById(req.user.id);
                if (currentUser && currentUser.subrole) {
                    const roleDoc = await Role.findOne({ name: currentUser.subrole });
                    if (roleDoc && roleDoc.permissions) {
                        const hasPermission = roleDoc.permissions['plans.delete'] === true;
                        if (!hasPermission) {
                            return res.status(403).json({
                                success: false,
                                message: 'You do not have permission to delete plans'
                            });
                        }
                    }
                }
            }

            const { serviceId } = req.params;

            const service = await Service.findById(serviceId);
            if (!service || service.isDeleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Service not found'
                });
            }

            // Check for active subscriptions
            const activeSubscriptions = await ServiceSubscription.countDocuments({
                serviceId,
                subscriptionStatus: { $in: ['active', 'pending'] }
            });

            if (activeSubscriptions > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot delete service with ${activeSubscriptions} active subscription(s). Please cancel all subscriptions first.`
                });
            }

            // Soft delete
            service.isDeleted = true;
            service.isActive = false;
            service.isAvailable = false;
            await service.save();

            res.json({
                success: true,
                message: 'Service deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting service:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete service',
            });
        }
    }

    /**
     * Fetch rate plans from wholesaler (ConnectTel)
     */
    static async getWholesalerRatePlans(req, res) {
        try {
            const result = await wholesalerService.getRatePlans();
            if (result.success) {
                return res.status(200).json(result);
            } else {
                return res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error fetching wholesaler rate plans:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch rate plans from wholesaler' });
        }
    }
}

module.exports = ServiceController;
