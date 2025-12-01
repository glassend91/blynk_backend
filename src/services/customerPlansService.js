const ServiceSubscription = require('../models/ServiceSubscription');
const Service = require('../models/Service');
const User = require('../models/User');
const mongoose = require('mongoose');

class CustomerPlansService {
    // Search customers and get their plans
    async searchCustomerPlans(searchQuery) {
        try {
            if (!searchQuery || !searchQuery.trim()) {
                throw new Error('Search query is required');
            }

            const query = searchQuery.trim().toLowerCase();
            const isEmail = query.includes('@');

            let customer;

            if (isEmail) {
                customer = await User.findOne({
                    email: { $regex: query, $options: 'i' },
                    role: 'customer',
                    isDeleted: { $ne: true }
                }).lean();
            } else {
                // Search by name or phone
                customer = await User.findOne({
                    $or: [
                        { firstName: { $regex: query, $options: 'i' } },
                        { lastName: { $regex: query, $options: 'i' } },
                        { phone: { $regex: query, $options: 'i' } }
                    ],
                    role: 'customer',
                    isDeleted: { $ne: true }
                }).lean();
            }

            if (!customer) {
                return {
                    customer: null,
                    plans: []
                };
            }

            // Get all active subscriptions for this customer
            const subscriptions = await ServiceSubscription.find({
                userId: customer._id,
                subscriptionStatus: { $in: ['active', 'pending', 'suspended'] }
            })
            .populate('serviceId', 'serviceName serviceType price currency billingCycle specifications')
            .sort({ createdAt: -1 })
            .lean();

            // Format plans
            const plans = subscriptions.map((sub) => {
                const service = sub.serviceId;
                if (!service) return null;

                const price = Number(service.price || 0);
                const currency = service.currency || 'AUD';
                const billingCycle = service.billingCycle || 'monthly';
                
                // Format price
                const formatter = new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 2,
                });
                
                const cycleLabel = billingCycle === 'monthly' ? 'month' : 
                                 billingCycle === 'quarterly' ? 'quarter' : 'year';
                const priceDisplay = `${formatter.format(price)}/${cycleLabel}`;

                // Format active since date
                const activeDate = sub.activatedAt || sub.subscribedAt || sub.createdAt || new Date();
                const activeSince = this.formatDate(activeDate);

                // Build service name
                let serviceName = service.serviceName || 'Service';
                if (service.serviceType === 'NBN' && service.specifications?.downloadSpeed) {
                    serviceName = `${service.serviceType} ${service.specifications.downloadSpeed}Mbps`;
                } else if (service.serviceType === 'Mobile' && service.specifications?.dataAllowance) {
                    serviceName = `${service.serviceType} ${service.specifications.dataAllowance}`;
                }

                return {
                    id: sub._id.toString(),
                    subscriptionId: sub._id.toString(),
                    serviceId: service._id ? service._id.toString() : '',
                    name: serviceName,
                    activeSince,
                    price: priceDisplay,
                    status: sub.subscriptionStatus,
                    serviceType: service.serviceType
                };
            }).filter(Boolean);

            return {
                customer: {
                    id: customer._id.toString(),
                    firstName: customer.firstName || '',
                    lastName: customer.lastName || '',
                    email: customer.email || '',
                    phone: customer.phone || ''
                },
                plans
            };
        } catch (error) {
            throw new Error(`Failed to search customer plans: ${error.message}`);
        }
    }

    // Get all plans for a specific customer by ID
    async getCustomerPlans(customerId) {
        try {
            const customer = await User.findById(customerId).lean();
            
            if (!customer || customer.role !== 'customer' || customer.isDeleted) {
                throw new Error('Customer not found');
            }

            const subscriptions = await ServiceSubscription.find({
                userId: customerId,
                subscriptionStatus: { $in: ['active', 'pending', 'suspended'] }
            })
            .populate('serviceId', 'serviceName serviceType price currency billingCycle specifications')
            .sort({ createdAt: -1 })
            .lean();

            const plans = subscriptions.map((sub) => {
                const service = sub.serviceId;
                if (!service) return null;

                const price = Number(service.price || 0);
                const currency = service.currency || 'AUD';
                const billingCycle = service.billingCycle || 'monthly';
                
                const formatter = new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 2,
                });
                
                const cycleLabel = billingCycle === 'monthly' ? 'month' : 
                                 billingCycle === 'quarterly' ? 'quarter' : 'year';
                const priceDisplay = `${formatter.format(price)}/${cycleLabel}`;

                const activeDate = sub.activatedAt || sub.subscribedAt || sub.createdAt || new Date();
                const activeSince = this.formatDate(activeDate);

                let serviceName = service.serviceName || 'Service';
                if (service.serviceType === 'NBN' && service.specifications?.downloadSpeed) {
                    serviceName = `${service.serviceType} ${service.specifications.downloadSpeed}Mbps`;
                } else if (service.serviceType === 'Mobile' && service.specifications?.dataAllowance) {
                    serviceName = `${service.serviceType} ${service.specifications.dataAllowance}`;
                }

                return {
                    id: sub._id.toString(),
                    subscriptionId: sub._id.toString(),
                    serviceId: service._id ? service._id.toString() : '',
                    name: serviceName,
                    activeSince,
                    price: priceDisplay,
                    status: sub.subscriptionStatus,
                    serviceType: service.serviceType
                };
            }).filter(Boolean);

            return {
                customer: {
                    id: customer._id.toString(),
                    firstName: customer.firstName || '',
                    lastName: customer.lastName || '',
                    email: customer.email || '',
                    phone: customer.phone || ''
                },
                plans
            };
        } catch (error) {
            throw new Error(`Failed to get customer plans: ${error.message}`);
        }
    }

    // Add service to customer (admin function)
    async addServiceToCustomer(customerId, serviceId, assignedAddress, assignedNumber) {
        try {
            // Verify customer exists
            const customer = await User.findById(customerId);
            if (!customer || customer.role !== 'customer' || customer.isDeleted) {
                throw new Error('Customer not found');
            }

            // Verify service exists
            const service = await Service.findById(serviceId);
            if (!service || !service.isAvailable) {
                throw new Error('Service not available');
            }

            // Check if customer already has this service
            const existingSubscription = await ServiceSubscription.findOne({
                userId: customerId,
                serviceId,
                subscriptionStatus: { $in: ['active', 'pending', 'suspended'] }
            });

            if (existingSubscription) {
                throw new Error('Customer already has an active subscription to this service');
            }

            // Calculate expiry date based on billing cycle
            const now = new Date();
            let expiresAt;
            if (service.billingCycle === 'monthly') {
                expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
            } else if (service.billingCycle === 'quarterly') {
                expiresAt = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
            } else {
                expiresAt = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
            }

            // Create subscription
            const subscription = new ServiceSubscription({
                serviceId,
                userId: customerId,
                subscriptionStatus: 'active',
                assignedNumber,
                assignedAddress,
                subscriptionPrice: service.price,
                currency: service.currency,
                billingCycle: service.billingCycle,
                subscribedAt: now,
                activatedAt: now,
                expiresAt,
                nextBillingDate: expiresAt,
                paymentStatus: 'pending'
            });

            await subscription.save();

            // Increment service subscription count
            const serviceDoc = await Service.findById(serviceId);
            if (serviceDoc && serviceDoc.incrementSubscriptionCount) {
                await serviceDoc.incrementSubscriptionCount();
            }

            return subscription;
        } catch (error) {
            throw new Error(`Failed to add service to customer: ${error.message}`);
        }
    }

    // Get all available services
    async getAvailableServices() {
        try {
            const services = await Service.find({
                isActive: true,
                isAvailable: true
            })
            .select('serviceName serviceType price currency billingCycle specifications')
            .sort({ serviceName: 1 })
            .lean();

            return services.map((service) => {
                const price = Number(service.price || 0);
                const currency = service.currency || 'AUD';
                const billingCycle = service.billingCycle || 'monthly';
                
                const formatter = new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency,
                    minimumFractionDigits: 2,
                });
                
                const cycleLabel = billingCycle === 'monthly' ? 'month' : 
                                 billingCycle === 'quarterly' ? 'quarter' : 'year';
                const priceDisplay = `${formatter.format(price)}/${cycleLabel}`;

                let serviceName = service.serviceName || 'Service';
                if (service.serviceType === 'NBN' && service.specifications?.downloadSpeed) {
                    serviceName = `${service.serviceType} ${service.specifications.downloadSpeed}Mbps`;
                } else if (service.serviceType === 'Mobile' && service.specifications?.dataAllowance) {
                    serviceName = `${service.serviceType} ${service.specifications.dataAllowance}`;
                }

                return {
                    id: service._id.toString(),
                    name: serviceName,
                    serviceType: service.serviceType,
                    price: priceDisplay,
                    originalPrice: price,
                    currency,
                    billingCycle
                };
            });
        } catch (error) {
            throw new Error(`Failed to fetch available services: ${error.message}`);
        }
    }

    // Format date to "Jan 15, 2024" format
    formatDate(date) {
        if (!date) return 'N/A';
        const d = new Date(date);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
}

module.exports = new CustomerPlansService();

