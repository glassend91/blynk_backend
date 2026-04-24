const supportTicketService = require('../services/supportTicketService');
const { validationResult } = require('express-validator');
const User = require('../models/User');

class SupportTicketController {
    // Create a new support ticket
    async createPublicTicket(req, res) {
        try {
            const { fullName, email, phone, subject, message, contactMethod } = req.body;

            if (!fullName || !email || !subject || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            // Try to find user by email
            let user = await User.findOne({ email: email.toLowerCase() });

            if (!user) {
                // Create a new guest user
                const nameParts = fullName.split(' ');
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(' ') || 'Guest';

                user = new User({
                    firstName,
                    lastName,
                    email: email.toLowerCase(),
                    phone,
                    passwordHash: 'GUEST_USER_NO_PASSWORD',
                    role: 'customer',
                    status: 'Pending',
                    type: '-',
                    customerType: 'residential'
                });
                await user.save();
            }

            const description = `Preferred Contact Method: ${contactMethod || 'Email'}\nPhone Number: ${phone || 'N/A'}\n\nMessage:\n${message}`;

            const ticketData = {
                subject: subject,
                description: description,
                category: 'General',
                priority: 'Medium',
                customerId: user._id,
                source: 'Web'
            };

            const ticket = await supportTicketService.createTicket(ticketData);

            res.status(201).json({
                success: true,
                message: 'Support ticket submitted successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create a new support ticket
    async createTicket(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const ticketData = {
                subject: req.body.subject,
                description: req.body.description,
                category: req.body.category,
                // Only allow admin to set priority, customers will get default "Medium"
                priority: req.user.role === 'admin' ? req.body.priority : undefined,
                customerId: req.user.id, // Assuming user is authenticated
                tags: req.body.tags,
                source: req.body.source
            };

            const ticket = await supportTicketService.createTicket(ticketData);

            res.status(201).json({
                success: true,
                message: 'Support ticket created successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get all tickets with filtering and pagination
    async getTickets(req, res) {
        try {
            const {
                status,
                category,
                priority,
                assignedTo,
                search,
                page = 1,
                limit = 10
            } = req.query;

            const filters = {};
            if (status) filters.status = status;
            if (category) filters.category = category;
            if (priority) filters.priority = priority;
            if (assignedTo) filters.assignedTo = assignedTo;

            // If user is not admin, only show their tickets
            if (req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
                filters.customerId = req.user.id;
            }

            const result = await supportTicketService.getTickets(
                filters,
                parseInt(page),
                parseInt(limit)
            );

            res.status(200).json({
                success: true,
                data: {
                    tickets: result.tickets.map(ticket => ticket.toSafeJSON()),
                    pagination: result.pagination
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get ticket by ID
    async getTicketById(req, res) {
        try {
            const { id } = req.params;
            const ticket = await supportTicketService.getTicketById(id);

            // Check if user has permission to view this ticket
            if (req.user.role !== 'admin' && ticket.customer._id.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            res.status(200).json({
                success: true,
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }


    // Update ticket
    async updateTicket(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            let updateData = req.body;

            // Non-admin users can only update certain fields (removed priority - only admins can set it)
            const adminRoles = ['admin', 'superAdmin', 'administrator', 'support', 'supportManager', 'technicalSupport'];
            if (!adminRoles.includes(req.user.role)) {
                const allowedFields = ['tags']; // Removed 'priority' - customers cannot set priority
                const filteredData = {};
                allowedFields.forEach(field => {
                    if (updateData[field] !== undefined) {
                        filteredData[field] = updateData[field];
                    }
                });
                updateData = filteredData; // Only allow tags for non-admin users
            }

            const ticket = await supportTicketService.updateTicket(id, updateData);

            res.status(200).json({
                success: true,
                message: 'Ticket updated successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Add message to ticket
    async addMessage(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const messageData = {
                senderId: req.user.id,
                content: req.body.content,
                isFromAdmin: req.user.role === 'admin',
                attachments: req.body.attachments || []
            };

            const ticket = await supportTicketService.addMessage(id, messageData);

            res.status(200).json({
                success: true,
                message: 'Message added successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Assign ticket to admin
    async assignTicket(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { id } = req.params;
            const { adminId } = req.body;

            const ticket = await supportTicketService.assignTicket(id, adminId);

            res.status(200).json({
                success: true,
                message: 'Ticket assigned successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Close ticket
    async closeTicket(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { id } = req.params;
            const ticket = await supportTicketService.closeTicket(id, req.user.id);

            res.status(200).json({
                success: true,
                message: 'Ticket closed successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get ticket statistics
    async getStatistics(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const stats = await supportTicketService.getStatistics();

            // Format response time to hours
            if (stats.avgResponseTime) {
                stats.avgResponseTimeHours = Math.round(stats.avgResponseTime / (1000 * 60 * 60) * 100) / 100;
            }

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get customer tickets
    async getCustomerTickets(req, res) {
        try {
            const { customerId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            // Check if user has permission to view these tickets
            if (req.user.role !== 'admin' && customerId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            const result = await supportTicketService.getCustomerTickets(
                customerId,
                parseInt(page),
                parseInt(limit)
            );

            res.status(200).json({
                success: true,
                data: {
                    tickets: result.tickets.map(ticket => ticket.toSafeJSON()),
                    pagination: result.pagination
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Search tickets
    async searchTickets(req, res) {
        try {
            const { q, page = 1, limit = 10 } = req.query;
            const filters = {};

            // If user is not admin, only search their tickets
            if (req.user.role !== 'admin') {
                filters.customerId = req.user.id;
            }

            const result = await supportTicketService.searchTickets(
                q,
                filters,
                parseInt(page),
                parseInt(limit)
            );

            res.status(200).json({
                success: true,
                data: {
                    tickets: result.tickets.map(ticket => ticket.toSafeJSON()),
                    pagination: result.pagination
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Rate ticket satisfaction
    async rateTicket(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { rating, feedback } = req.body;

            // Check if user has permission to rate this ticket
            const ticket = await supportTicketService.getTicketById(id);
            if (req.user.role !== 'admin' && ticket.customer._id.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            const updatedTicket = await supportTicketService.rateTicket(id, rating, feedback);

            res.status(200).json({
                success: true,
                message: 'Rating submitted successfully',
                data: updatedTicket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete ticket (soft delete)
    async deleteTicket(req, res) {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { id } = req.params;
            const ticket = await supportTicketService.deleteTicket(id);

            res.status(200).json({
                success: true,
                message: 'Ticket deleted successfully',
                data: ticket.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new SupportTicketController();
