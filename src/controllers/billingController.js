const Invoice = require('../models/Invoice');
const BillingAccount = require('../models/BillingAccount');
const User = require('../models/User');
const ServiceSubscription = require('../models/ServiceSubscription');
const InvoiceService = require('../services/invoiceService');
const stripe = require('../config/stripe');
const { generateInvoicePDF, generateInvoiceFilename } = require('../utils/pdfGenerator');

class BillingController {
    // Get billing summary for dashboard
    static async getBillingSummary(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // If no Stripe customer ID, return empty/default summary
            if (!user.stripeCustomerId) {
                return res.json({
                    success: true,
                    data: {
                        currentBalance: 0,
                        nextBillingDate: new Date().toISOString(),
                        monthlyAmount: 0,
                        recentInvoices: [],
                        billingAccount: {
                            status: 'active',
                            autoPayEnabled: user.autoPayEnabled || false,
                            creditLimit: 0
                        }
                    }
                });
            }

            // Fetch Stripe customer details for balance
            const customer = await stripe.customers.retrieve(user.stripeCustomerId);

            // Fetch recent invoices and standalone charges from Stripe
            const [stripeInvoices, stripeCharges] = await Promise.all([
                stripe.invoices.list({ customer: user.stripeCustomerId, limit: 10 }),
                stripe.charges.list({ customer: user.stripeCustomerId, limit: 10 })
            ]);

            // Map and merge both into a unified "Invoice" format for the dashboard
            const recentInvoices = [
                ...stripeInvoices.data.map(inv => ({
                    id: inv.id,
                    invoiceNumber: inv.number,
                    status: inv.status === 'open' ? 'sent' : inv.status,
                    total: inv.total / 100,
                    createdAt: new Date(inv.created * 1000).toISOString(),
                    type: 'invoice'
                })),
                ...stripeCharges.data
                    .filter(charge => !charge.invoice)
                    .map(charge => ({
                        id: charge.id,
                        invoiceNumber: `PMT-${charge.id.slice(-6).toUpperCase()}`,
                        status: charge.status === 'succeeded' ? 'paid' : (charge.status === 'pending' ? 'sent' : 'overdue'),
                        total: charge.amount / 100,
                        createdAt: new Date(charge.created * 1000).toISOString(),
                        type: 'payment',
                        description: charge.description || 'Signup Fee'
                    }))
            ]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            res.json({
                success: true,
                data: {
                    currentBalance: (customer.balance || 0) / 100,
                    nextBillingDate: new Date().toISOString(), // Mock
                    monthlyAmount: 0, // Mock
                    recentInvoices: recentInvoices,
                    billingAccount: {
                        status: user.status || 'Active',
                        autoPayEnabled: user.autoPayEnabled || false,
                        creditLimit: 0
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
            const user = await User.findById(userId);

            if (!user || !user.stripeCustomerId) {
                return res.json({ success: true, data: { invoices: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 } } });
            }

            const { page = 1, limit = 10, status } = req.query;

            // Fetch both invoices and standalone charges for full history
            const [stripeInvoices, stripeCharges] = await Promise.all([
                stripe.invoices.list({ customer: user.stripeCustomerId, limit: parseInt(limit) }),
                stripe.charges.list({ customer: user.stripeCustomerId, limit: 100 })
            ]);

            const mappedInvoices = stripeInvoices.data.map(inv => ({
                id: inv.id,
                invoiceNumber: inv.number,
                status: inv.status === 'open' ? 'sent' : inv.status,
                total: inv.total / 100,
                dueDate: new Date(inv.due_date * 1000 || inv.created * 1000).toISOString(),
                createdAt: new Date(inv.created * 1000).toISOString(),
                billingPeriod: {
                    startDate: new Date(inv.period_start * 1000).toISOString(),
                    endDate: new Date(inv.period_end * 1000).toISOString()
                },
                lineItems: inv.lines.data.map(line => ({
                    description: line.description,
                    amount: line.amount / 100
                })),
                type: 'invoice',
                receiptUrl: inv.hosted_invoice_url
            }));

            const mappedCharges = stripeCharges.data
                .filter(charge => !charge.invoice)
                .map(charge => ({
                    id: charge.id,
                    invoiceNumber: `PMT-${charge.id.slice(-6).toUpperCase()}`,
                    status: charge.status === 'succeeded' ? 'paid' : (charge.status === 'pending' ? 'sent' : 'overdue'),
                    total: charge.amount / 100,
                    dueDate: new Date(charge.created * 1000).toISOString(),
                    createdAt: new Date(charge.created * 1000).toISOString(),
                    type: 'payment',
                    receiptUrl: charge.receipt_url,
                    lineItems: [{ description: charge.description || 'Signup Fee', amount: charge.amount / 100 }]
                }));

            const allInvoices = [...mappedInvoices, ...mappedCharges]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            res.json({
                success: true,
                data: {
                    invoices: allInvoices,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(allInvoices.length / limit),
                        totalItems: allInvoices.length,
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

            // Handle Stripe IDs (Invoices or Charges)
            if (invoiceId.startsWith('in_') || invoiceId.startsWith('ch_')) {
                let data;
                if (invoiceId.startsWith('in_')) {
                    data = await stripe.invoices.retrieve(invoiceId);
                } else {
                    data = await stripe.charges.retrieve(invoiceId);
                }
                return res.json({ success: true, data });
            }

            const invoice = await Invoice.findOne({
                _id: invoiceId,
                customerId: userId
            }).populate('paymentMethod', 'type last4');

            if (!invoice) {
                return res.status(404).json({ success: false, message: 'Invoice not found' });
            }

            res.json({ success: true, data: invoice });
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

    // Generate and download invoice PDF
    static async getInvoicePDF(req, res, next) {
        try {
            const { invoiceId } = req.params;
            const userId = req.user.id;

            // Handle Stripe IDs directly by returning their hosted URLs
            if (invoiceId.startsWith('in_') || invoiceId.startsWith('ch_')) {
                let downloadUrl;
                if (invoiceId.startsWith('in_')) {
                    const stripeInvoice = await stripe.invoices.retrieve(invoiceId);
                    downloadUrl = stripeInvoice.invoice_pdf;
                } else {
                    const stripeCharge = await stripe.charges.retrieve(invoiceId);
                    downloadUrl = stripeCharge.receipt_url;
                }
                return res.json({ success: true, data: { downloadUrl } });
            }

            const invoice = await Invoice.findOne({
                _id: invoiceId,
                customerId: userId
            }).populate('customerId', 'firstName lastName email phone billingAddress serviceAddress businessDetails');

            if (!invoice) {
                return res.status(404).json({ success: false, message: 'Invoice not found' });
            }

            const customer = invoice.customerId || await User.findById(userId);

            // Generate PDF locally for non-Stripe invoices
            const pdfBuffer = await generateInvoicePDF(invoice, customer);
            const filename = generateInvoiceFilename(invoice, customer);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
        } catch (error) {
            console.error('Error generating invoice PDF:', error);
            next(error);
        }
    }

    // Admin: Download invoice PDF for any customer
    static async downloadCustomerInvoicePDF(req, res, next) {
        try {
            const { invoiceId } = req.params;

            const invoice = await Invoice.findById(invoiceId);

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Invoice not found'
                });
            }

            // Get customer data - populate if needed
            let customer = invoice.customerId;
            if (!customer || typeof customer === 'string' || (customer.toString && customer.toString().length === 24)) {
                customer = await User.findById(invoice.customerId)
                    .select('firstName lastName email phone billingAddress serviceAddress businessDetails');
            }

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            // Generate PDF
            const pdfBuffer = await generateInvoicePDF(invoice, customer);
            const filename = generateInvoiceFilename(invoice, customer);

            // Set response headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            res.send(pdfBuffer);
        } catch (error) {
            console.error('Error generating invoice PDF:', error);
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

    // Admin: Get invoices for a specific customer
    static async getCustomerInvoices(req, res, next) {
        try {
            const { customerId } = req.params;
            const { page = 1, limit = 50, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

            // Validate customerId
            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID is required'
                });
            }

            const skip = (page - 1) * limit;
            const filter = { customerId };

            // Add status filter
            if (status) {
                filter.status = status;
            }

            // Build sort object
            const sort = {};
            const validSortFields = ['createdAt', 'dueDate', 'total', 'status', 'invoiceNumber'];
            const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
            sort[sortField] = sortOrder === 'asc' ? 1 : -1;

            const invoices = await Invoice.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('paymentMethod', 'type last4')
                .lean();

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
}

module.exports = BillingController;
