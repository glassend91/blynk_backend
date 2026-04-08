const Invoice = require('../models/Invoice');
const ServiceSubscription = require('../models/ServiceSubscription');
const PackageSelection = require('../models/PackageSelection');
const Service = require('../models/Service');
const Package = require('../models/Package');
const User = require('../models/User');

class InvoiceService {
    // Generate invoice for a specific service subscription
    static async generateServiceInvoice(userId, subscriptionId, billingPeriod) {
        try {
            const subscription = await ServiceSubscription.findOne({
                _id: subscriptionId,
                userId: userId
            }).populate('serviceId');

            if (!subscription) {
                throw new Error('Subscription not found');
            }

            const service = subscription.serviceId;
            const invoiceNumber = await Invoice.generateInvoiceNumber();

            // Validate service data
            if (!service || (!service.name && !service.serviceName) || service.price === undefined) {
                throw new Error('Service data is invalid for invoice generation');
            }

            // Create line items
            const lineItems = [{
                description: service.name || service.serviceName || 'Service Subscription',
                quantity: 1,
                unitPrice: subscription.subscriptionPrice || service.price || 0,
                amount: subscription.subscriptionPrice || service.price || 0,
                serviceId: service._id,
                subscriptionId: subscription._id
            }];

            // Add add-ons if any
            if (subscription.selectedAddOns && subscription.selectedAddOns.length > 0) {
                subscription.selectedAddOns.forEach(addOn => {
                    if (addOn && addOn.isActive && addOn.name && addOn.price !== undefined) {
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
            const discount = 0; // Could be calculated based on business rules
            const tax = subtotal * 0.10; // 10% GST
            const total = subtotal + tax;

            const invoice = new Invoice({
                invoiceNumber: invoiceNumber,
                customerId: userId,
                billingPeriod: billingPeriod,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                status: 'sent',
                subtotal: subtotal,
                discount: discount,
                tax: tax,
                total: total,
                currency: service.currency || 'AUD',
                lineItems: lineItems,
                notes: `Monthly service invoice for ${service.name}`
            });

            await invoice.save();
            console.log(`✅ Generated service invoice ${invoiceNumber}: $${total.toFixed(2)}`);
            return invoice;

        } catch (error) {
            console.error('Error generating service invoice:', error);
            throw error;
        }
    }

    // Generate invoice for a specific package selection
    static async generatePackageInvoice(userId, packageSelectionId, billingPeriod) {
        try {
            const packageSelection = await PackageSelection.findOne({
                _id: packageSelectionId,
                customerId: userId
            }).populate('packageId');

            if (!packageSelection) {
                throw new Error('Package selection not found');
            }

            const packageData = packageSelection.packageId;

            // Validate package data
            if (!packageData || !packageData.planTitle || packageData.price === undefined) {
                throw new Error('Package data is invalid for invoice generation');
            }

            const invoiceNumber = await Invoice.generateInvoiceNumber();

            const subtotal = packageData.price || 0;
            const discount = 0;
            const tax = subtotal * 0.10; // 10% GST
            const total = subtotal + tax;

            const invoice = new Invoice({
                invoiceNumber: invoiceNumber,
                customerId: userId,
                billingPeriod: billingPeriod,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                status: 'sent',
                subtotal: subtotal,
                discount: discount,
                tax: tax,
                total: total,
                currency: packageData.currency || 'AUD',
                lineItems: [{
                    description: packageData.planTitle,
                    quantity: 1,
                    unitPrice: packageData.price,
                    amount: packageData.price,
                    serviceId: packageData._id,
                    subscriptionId: packageSelection._id
                }],
                notes: `Package purchase invoice for ${packageData.planTitle}`
            });

            await invoice.save();
            console.log(`✅ Generated package invoice ${invoiceNumber}: $${total.toFixed(2)}`);
            return invoice;

        } catch (error) {
            console.error('Error generating package invoice:', error);
            throw error;
        }
    }

    // Generate monthly invoices for all active subscriptions
    static async generateMonthlyInvoices(userId) {
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            const billingPeriod = {
                startDate: startOfMonth,
                endDate: endOfMonth
            };

            const invoices = [];

            // Get active service subscriptions
            const serviceSubscriptions = await ServiceSubscription.find({
                userId: userId,
                subscriptionStatus: 'active'
            }).populate('serviceId');

            // Get active package selections
            const packageSelections = await PackageSelection.find({
                customerId: userId,
                status: 'active'
            }).populate('packageId');

            // Generate invoices for service subscriptions
            for (const subscription of serviceSubscriptions) {
                try {
                    const invoice = await this.generateServiceInvoice(
                        userId,
                        subscription._id,
                        billingPeriod
                    );
                    invoices.push(invoice);
                } catch (error) {
                    console.error(`Error generating invoice for subscription ${subscription._id}:`, error);
                }
            }

            // Generate invoices for package selections
            for (const packageSelection of packageSelections) {
                try {
                    const invoice = await this.generatePackageInvoice(
                        userId,
                        packageSelection._id,
                        billingPeriod
                    );
                    invoices.push(invoice);
                } catch (error) {
                    console.error(`Error generating invoice for package ${packageSelection._id}:`, error);
                }
            }

            console.log(`✅ Generated ${invoices.length} monthly invoices for user ${userId}`);
            return invoices;

        } catch (error) {
            console.error('Error generating monthly invoices:', error);
            throw error;
        }
    }

    // Generate consolidated invoice for all user's active services/packages
    static async generateConsolidatedInvoice(userId, billingPeriod) {
        try {
            const invoiceNumber = await Invoice.generateInvoiceNumber();
            const lineItems = [];
            let totalSubtotal = 0;

            // Get active service subscriptions
            const serviceSubscriptions = await ServiceSubscription.find({
                userId: userId,
                subscriptionStatus: 'active'
            }).populate('serviceId');

            // Get active package selections
            const packageSelections = await PackageSelection.find({
                customerId: userId,
                status: 'active'
            }).populate('packageId');

            // Add service subscription line items
            serviceSubscriptions.forEach(subscription => {
                const service = subscription.serviceId;
                const amount = subscription.subscriptionPrice || service.price;
                totalSubtotal += amount;

                lineItems.push({
                    description: service.name || service.serviceName || 'Service Subscription',
                    quantity: 1,
                    unitPrice: amount,
                    amount: amount,
                    serviceId: service._id,
                    subscriptionId: subscription._id
                });

                // Add add-ons
                if (subscription.selectedAddOns && subscription.selectedAddOns.length > 0) {
                    subscription.selectedAddOns.forEach(addOn => {
                        if (addOn.isActive) {
                            totalSubtotal += addOn.price;
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
            });

            // Add package selection line items
            packageSelections.forEach(packageSelection => {
                const packageData = packageSelection.packageId;
                totalSubtotal += packageData.price;

                lineItems.push({
                    description: packageData.planTitle,
                    quantity: 1,
                    unitPrice: packageData.price,
                    amount: packageData.price,
                    serviceId: packageData._id,
                    subscriptionId: packageSelection._id
                });
            });

            // Calculate totals
            const subtotal = totalSubtotal;
            const discount = lineItems.length > 1 ? 20.00 : 0; // Bundle discount for multiple services
            const tax = (subtotal - discount) * 0.10; // 10% GST
            const total = subtotal - discount + tax;

            const invoice = new Invoice({
                invoiceNumber: invoiceNumber,
                customerId: userId,
                billingPeriod: billingPeriod,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                status: 'sent',
                subtotal: subtotal,
                discount: discount,
                tax: tax,
                total: total,
                currency: 'AUD',
                lineItems: lineItems,
                notes: `Consolidated monthly invoice for all services and packages`
            });

            await invoice.save();
            console.log(`✅ Generated consolidated invoice ${invoiceNumber}: $${total.toFixed(2)}`);
            return invoice;

        } catch (error) {
            console.error('Error generating consolidated invoice:', error);
            throw error;
        }
    }

    // Get invoice summary for user
    static async getInvoiceSummary(userId) {
        try {
            const invoices = await Invoice.find({ customerId: userId })
                .sort({ createdAt: -1 })
                .limit(10);

            const totalInvoices = await Invoice.countDocuments({ customerId: userId });
            const paidInvoices = await Invoice.countDocuments({
                customerId: userId,
                status: 'paid'
            });
            const pendingInvoices = await Invoice.countDocuments({
                customerId: userId,
                status: 'sent'
            });
            const overdueInvoices = await Invoice.countDocuments({
                customerId: userId,
                status: 'overdue'
            });

            const totalAmount = await Invoice.aggregate([
                { $match: { customerId: userId, status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]);

            return {
                recentInvoices: invoices,
                summary: {
                    totalInvoices,
                    paidInvoices,
                    pendingInvoices,
                    overdueInvoices,
                    totalPaidAmount: totalAmount.length > 0 ? totalAmount[0].total : 0
                }
            };

        } catch (error) {
            console.error('Error getting invoice summary:', error);
            throw error;
        }
    }
}

module.exports = InvoiceService;
