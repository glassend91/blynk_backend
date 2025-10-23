const Invoice = require('../models/Invoice');
const BillingAccount = require('../models/BillingAccount');
const User = require('../models/User');
const ServiceSubscription = require('../models/ServiceSubscription');
const InvoiceService = require('../services/invoiceService');

class BillingController {
    // Get billing summary for dashboard
    static async getBillingSummary(req, res, next) {
        try {
            const userId = req.user.id
            // Get billing account or create one if it doesn't exist
            let billingAccount = await BillingAccount.findOne({ customerId: userId });
            if (!billingAccount) {
                // Auto-create billing account for new users
                billingAccount = new BillingAccount({
                    customerId: userId,
                    billingCycle: 'monthly',
                    creditLimit: 0,
                    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                });
                billingAccount.calculateNextBillingDate();
                await billingAccount.save();
            }

            // Get recent invoices
            const recentInvoices = await Invoice.find({ customerId: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('invoiceNumber status total dueDate createdAt');

            // Get current month charges (this would typically come from subscriptions)
            const currentMonth = new Date();
            currentMonth.setDate(1);
            const nextMonth = new Date(currentMonth);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            const currentMonthInvoices = await Invoice.find({
                customerId: userId,
                billingPeriod: {
                    $gte: currentMonth,
                    $lt: nextMonth
                }
            });

            const currentMonthTotal = currentMonthInvoices.reduce((sum, invoice) => sum + invoice.total, 0);

            // Calculate next billing date
            const nextBillingDate = billingAccount.nextBillingDate;

            res.json({
                success: true,
                data: {
                    currentBalance: billingAccount.currentBalance,
                    nextBillingDate: nextBillingDate,
                    monthlyAmount: currentMonthTotal,
                    recentInvoices: recentInvoices,
                    billingAccount: {
                        status: billingAccount.status,
                        autoPayEnabled: billingAccount.autoPayEnabled,
                        creditLimit: billingAccount.creditLimit
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Get all invoices with pagination and filtering
    static async getInvoices(req, res, next) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 10, status, year, month } = req.query;

            const skip = (page - 1) * limit;
            const filter = { customerId: userId };

            // Add status filter
            if (status) {
                filter.status = status;
            }

            // Add date filters
            if (year || month) {
                const startDate = new Date();
                const endDate = new Date();

                if (year) {
                    startDate.setFullYear(parseInt(year));
                    endDate.setFullYear(parseInt(year) + 1);
                }

                if (month) {
                    startDate.setMonth(parseInt(month) - 1);
                    endDate.setMonth(parseInt(month));
                }

                filter.createdAt = { $gte: startDate, $lt: endDate };
            }

            const invoices = await Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('paymentMethod', 'type last4');

            const total = await Invoice.countDocuments(filter);

            res.json({
                success: true,
                data: {
                    invoices,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: parseInt(limit)
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Get invoice by ID
    static async getInvoiceById(req, res, next) {
        try {
            const { invoiceId } = req.params;
            const userId = req.user.id;

            const invoice = await Invoice.findOne({
                _id: invoiceId,
                customerId: userId
            }).populate('paymentMethod', 'type last4');

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }

            res.json({
                success: true,
                data: invoice
            });
        } catch (error) {
            next(error);
        }
    }

    // Get current month charges breakdown
    static async getCurrentMonthCharges(req, res, next) {
        try {
            const userId = req.user.id;

            // Get current month date range
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            // Get active subscriptions for current month
            const subscriptions = await ServiceSubscription.find({
                userId: userId,
                subscriptionStatus: 'active',
                subscribedAt: { $lte: endOfMonth },
                $or: [
                    { expiresAt: { $gte: startOfMonth } },
                    { expiresAt: null }
                ]
            }).populate('serviceId', 'name serviceName price');

            // Calculate charges
            let subtotal = 0;
            let discount = 0;
            const lineItems = [];

            subscriptions.forEach(subscription => {
                const service = subscription.serviceId;
                if (service) {
                    const amount = subscription.subscriptionPrice || service.price;
                    subtotal += amount;

                    lineItems.push({
                        description: service.name || service.serviceName || 'Service Subscription',
                        quantity: 1,
                        unitPrice: amount,
                        amount: amount,
                        serviceId: service._id,
                        subscriptionId: subscription._id,
                        serviceName: service.name || service.serviceName,
                        servicePrice: service.price
                    });
                }
            });

            // Apply bundle discount if multiple services
            if (subscriptions.length > 1) {
                discount = 20.00; // $20 bundle discount
            }

            const tax = (subtotal - discount) * 0.10; // 10% GST
            const total = subtotal - discount + tax;

            res.json({
                success: true,
                data: {
                    lineItems,
                    subtotal,
                    discount,
                    tax,
                    total,
                    currency: 'AUD'
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Download invoice PDF
    static async downloadInvoice(req, res, next) {
        try {
            const { invoiceId } = req.params;
            const userId = req.user.id;

            const invoice = await Invoice.findOne({
                _id: invoiceId,
                customerId: userId
            });

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }

            // In a real implementation, you would generate a PDF here
            // For now, we'll return the invoice data
            res.json({
                success: true,
                message: 'PDF generation would be implemented here',
                data: {
                    invoiceNumber: invoice.invoiceNumber,
                    downloadUrl: `/api/billing/invoices/${invoiceId}/pdf`
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Update billing account settings
    static async updateBillingSettings(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                autoPayEnabled,
                billingCycle,
                notificationSettings,
                billingAddress
            } = req.body;

            const billingAccount = await BillingAccount.findOne({ customerId: userId });
            if (!billingAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Billing account not found'
                });
            }

            // Update fields
            if (autoPayEnabled !== undefined) {
                billingAccount.autoPayEnabled = autoPayEnabled;
            }

            if (billingCycle) {
                billingAccount.billingCycle = billingCycle;
                billingAccount.calculateNextBillingDate();
            }

            if (notificationSettings) {
                billingAccount.notificationSettings = {
                    ...billingAccount.notificationSettings,
                    ...notificationSettings
                };
            }

            if (billingAddress) {
                billingAccount.billingAddress = {
                    ...billingAccount.billingAddress,
                    ...billingAddress
                };
            }

            await billingAccount.save();

            res.json({
                success: true,
                message: 'Billing settings updated successfully',
                data: billingAccount
            });
        } catch (error) {
            next(error);
        }
    }

    // Get billing account details
    static async getBillingAccount(req, res, next) {
        try {
            const userId = req.user.id;

            const billingAccount = await BillingAccount.findOne({ customerId: userId });
            if (!billingAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Billing account not found'
                });
            }

            res.json({
                success: true,
                data: billingAccount
            });
        } catch (error) {
            next(error);
        }
    }

    // Create billing account for new user
    static async createBillingAccount(req, res, next) {
        try {
            const userId = req.user.id;
            const { billingCycle = 'monthly', creditLimit = 0 } = req.body;

            // Check if billing account already exists
            const existingAccount = await BillingAccount.findOne({ customerId: userId });
            if (existingAccount) {
                return res.status(400).json({
                    success: false,
                    message: 'Billing account already exists'
                });
            }

            const billingAccount = new BillingAccount({
                customerId: userId,
                billingCycle,
                creditLimit,
                nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            });

            billingAccount.calculateNextBillingDate();
            await billingAccount.save();

            res.status(201).json({
                success: true,
                message: 'Billing account created successfully',
                data: billingAccount
            });
        } catch (error) {
            next(error);
        }
    }

    // Generate invoice for billing period
    static async generateInvoice(req, res, next) {
        try {
            const userId = req.user.id;
            const { billingPeriodStart, billingPeriodEnd } = req.body;

            const billingAccount = await BillingAccount.findOne({ customerId: userId });
            if (!billingAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Billing account not found'
                });
            }

            // Get active subscriptions for the period
            const subscriptions = await ServiceSubscription.find({
                userId: userId,
                subscriptionStatus: 'active',
                subscribedAt: { $lte: new Date(billingPeriodEnd) },
                $or: [
                    { expiresAt: { $gte: new Date(billingPeriodStart) } },
                    { expiresAt: null }
                ]
            }).populate('serviceId');

            if (subscriptions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No active subscriptions found for the billing period'
                });
            }

            // Generate invoice number
            const invoiceNumber = await Invoice.generateInvoiceNumber();

            // Calculate line items
            const lineItems = [];
            let subtotal = 0;

            subscriptions.forEach(subscription => {
                const service = subscription.serviceId;
                if (service) {
                    const amount = subscription.subscriptionPrice || service.price;
                    subtotal += amount;

                    lineItems.push({
                        description: service.name,
                        quantity: 1,
                        unitPrice: amount,
                        amount: amount,
                        serviceId: service._id,
                        subscriptionId: subscription._id
                    });
                }
            });

            // Apply bundle discount
            const discount = subscriptions.length > 1 ? 20.00 : 0;
            const tax = (subtotal - discount) * billingAccount.taxRate;
            const total = subtotal - discount + tax;

            const invoice = new Invoice({
                invoiceNumber,
                customerId: userId,
                billingPeriod: {
                    startDate: new Date(billingPeriodStart),
                    endDate: new Date(billingPeriodEnd)
                },
                dueDate: new Date(Date.now() + billingAccount.paymentTerms * 24 * 60 * 60 * 1000),
                subtotal,
                discount,
                tax,
                total,
                lineItems,
                status: 'draft'
            });

            await invoice.save();

            res.status(201).json({
                success: true,
                message: 'Invoice generated successfully',
                data: invoice
            });
        } catch (error) {
            next(error);
        }
    }

    // Generate sample invoices for testing
    static async generateSampleInvoices(req, res, next) {
        try {
            const userId = req.user.id;

            // Get user's active subscriptions
            const subscriptions = await ServiceSubscription.find({
                userId: userId,
                subscriptionStatus: 'active'
            }).populate('serviceId');

            if (subscriptions.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No active subscriptions found. Please subscribe to services first.'
                });
            }

            // Sample invoice data
            const sampleInvoices = [
                {
                    date: '2024-11-15',
                    description: 'NBN Only',
                    amount: 79.99,
                    status: 'paid'
                },
                {
                    date: '2024-12-15',
                    description: 'NBN + Mobile',
                    amount: 134.95,
                    status: 'paid'
                },
                {
                    date: '2025-01-15',
                    description: 'NBN + Mobile',
                    amount: 124.95,
                    status: 'paid'
                }
            ];

            const createdInvoices = [];

            for (const [index, data] of sampleInvoices.entries()) {
                const invoiceNumber = `INV-2025-${String(index + 1).padStart(3, '0')}`;

                // Check if invoice already exists
                const existingInvoice = await Invoice.findOne({ invoiceNumber });
                if (existingInvoice) {
                    continue;
                }

                // Create line items based on subscriptions
                const lineItems = [];
                let subtotal = 0;

                subscriptions.forEach(subscription => {
                    const service = subscription.serviceId;
                    if (service) {
                        const amount = subscription.subscriptionPrice || service.price;
                        subtotal += amount;

                        lineItems.push({
                            description: service.name,
                            quantity: 1,
                            unitPrice: amount,
                            amount: amount,
                            serviceId: service._id,
                            subscriptionId: subscription._id
                        });
                    }
                });

                const discount = subscriptions.length > 1 ? 20.00 : 0;
                const tax = (subtotal - discount) * 0.10;
                const total = subtotal - discount + tax;

                const invoice = new Invoice({
                    invoiceNumber: invoiceNumber,
                    customerId: userId,
                    billingPeriod: {
                        startDate: new Date(data.date),
                        endDate: new Date(data.date)
                    },
                    dueDate: new Date(data.date),
                    status: data.status,
                    subtotal: subtotal,
                    discount: discount,
                    tax: tax,
                    total: total,
                    currency: 'AUD',
                    lineItems: lineItems,
                    paymentDate: data.status === 'paid' ? new Date(data.date) : null,
                    paymentReference: data.status === 'paid' ? `PAY-${Date.now()}` : null
                });

                await invoice.save();
                createdInvoices.push(invoice);
            }

            res.status(201).json({
                success: true,
                message: `Generated ${createdInvoices.length} sample invoices`,
                data: createdInvoices
            });

        } catch (error) {
            next(error);
        }
    }

    // Generate monthly invoices for all active subscriptions
    static async generateMonthlyInvoices(req, res, next) {
        try {
            const userId = req.user.id;

            const invoices = await InvoiceService.generateMonthlyInvoices(userId);

            res.status(201).json({
                success: true,
                message: `Generated ${invoices.length} monthly invoices`,
                data: invoices
            });
        } catch (error) {
            next(error);
        }
    }

    // Generate consolidated invoice for all services and packages
    static async generateConsolidatedInvoice(req, res, next) {
        try {
            const userId = req.user.id;
            const { billingPeriodStart, billingPeriodEnd } = req.body;

            const billingPeriod = {
                startDate: new Date(billingPeriodStart),
                endDate: new Date(billingPeriodEnd)
            };

            const invoice = await InvoiceService.generateConsolidatedInvoice(userId, billingPeriod);

            res.status(201).json({
                success: true,
                message: 'Consolidated invoice generated successfully',
                data: invoice
            });
        } catch (error) {
            next(error);
        }
    }

    // Generate invoice for specific service subscription
    static async generateServiceInvoice(req, res, next) {
        try {
            const userId = req.user.id;
            const { subscriptionId } = req.params;
            const { billingPeriodStart, billingPeriodEnd } = req.body;

            const billingPeriod = {
                startDate: new Date(billingPeriodStart),
                endDate: new Date(billingPeriodEnd)
            };

            const invoice = await InvoiceService.generateServiceInvoice(userId, subscriptionId, billingPeriod);

            res.status(201).json({
                success: true,
                message: 'Service invoice generated successfully',
                data: invoice
            });
        } catch (error) {
            next(error);
        }
    }

    // Generate invoice for specific package selection
    static async generatePackageInvoice(req, res, next) {
        try {
            const userId = req.user.id;
            const { packageSelectionId } = req.params;
            const { billingPeriodStart, billingPeriodEnd } = req.body;

            const billingPeriod = {
                startDate: new Date(billingPeriodStart),
                endDate: new Date(billingPeriodEnd)
            };

            const invoice = await InvoiceService.generatePackageInvoice(userId, packageSelectionId, billingPeriod);

            res.status(201).json({
                success: true,
                message: 'Package invoice generated successfully',
                data: invoice
            });
        } catch (error) {
            next(error);
        }
    }

    // Get invoice summary
    static async getInvoiceSummary(req, res, next) {
        try {
            const userId = req.user.id;

            const summary = await InvoiceService.getInvoiceSummary(userId);

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = BillingController;
