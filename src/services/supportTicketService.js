const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');

class SupportTicketService {
    // Create a new support ticket
    async createTicket(ticketData) {
        try {
            const ticket = new SupportTicket({
                subject: ticketData.subject,
                description: ticketData.description,
                category: ticketData.category,
                priority: ticketData.priority || 'Medium',
                customer: ticketData.customerId,
                tags: ticketData.tags || [],
                source: ticketData.source || 'Web'
            });


            // Add initial message from customer
            ticket.messages.push({
                sender: ticketData.customerId,
                content: ticketData.description,
                isFromAdmin: false
            });

            console.log('TICKET LOG: ', ticket);
            await ticket.save();
            console.log('TICKET SAVED LOG: ', ticket);
            return await ticket.populate('customer', 'firstName lastName email');
        } catch (error) {
            throw new Error(`Failed to create ticket: ${error.message}`);
        }
    }

    // Get all tickets with filtering and pagination
    async getTickets(filters = {}, page = 1, limit = 10) {
        try {
            const query = {};

            // Apply filters
            if (filters.status) {
                query.status = filters.status;
            }
            if (filters.category) {
                query.category = filters.category;
            }
            if (filters.priority) {
                query.priority = filters.priority;
            }
            if (filters.customerId) {
                query.customer = filters.customerId;
            }
            if (filters.assignedTo) {
                query.assignedTo = filters.assignedTo;
            }
            if (filters.search) {
                query.$or = [
                    { subject: { $regex: filters.search, $options: 'i' } },
                    { description: { $regex: filters.search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;

            const tickets = await SupportTicket.find(query)
                .populate('customer', 'firstName lastName email')
                .populate('assignedTo', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await SupportTicket.countDocuments(query);

            return {
                tickets,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalTickets: total,
                    hasNextPage: page < Math.ceil(total / limit),
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw new Error(`Failed to fetch tickets: ${error.message}`);
        }
    }

    // Get ticket by ID
    async getTicketById(ticketId) {
        try {
            const ticket = await SupportTicket.findById(ticketId)
                .populate('customer', 'firstName lastName email phone')
                .populate('assignedTo', 'firstName lastName email')
                .populate('messages.sender', 'firstName lastName email');

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            return ticket;
        } catch (error) {
            throw new Error(`Failed to fetch ticket: ${error.message}`);
        }
    }


    // Update ticket
    async updateTicket(ticketId, updateData) {
        try {
            const ticket = await SupportTicket.findById(ticketId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            // Update fields
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    ticket[key] = updateData[key];
                }
            });

            // Set resolved timestamp if status is being changed to resolved
            if (updateData.status === 'Resolved' && ticket.status !== 'Resolved') {
                ticket.resolvedAt = new Date();
            }

            // Set closed timestamp if status is being changed to closed
            if (updateData.status === 'Closed' && ticket.status !== 'Closed') {
                ticket.closedAt = new Date();
            }

            ticket.lastActivity = new Date();
            await ticket.save();

            return await ticket.populate('customer', 'firstName lastName email')
                .populate('assignedTo', 'firstName lastName email');
        } catch (error) {
            throw new Error(`Failed to update ticket: ${error.message}`);
        }
    }

    // Add message to ticket
    async addMessage(ticketId, messageData) {
        try {
            const ticket = await SupportTicket.findById(ticketId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            await ticket.addMessage(
                messageData.senderId,
                messageData.content,
                messageData.isFromAdmin,
                messageData.attachments || []
            );

            return await ticket.populate('messages.sender', 'firstName lastName email');
        } catch (error) {
            throw new Error(`Failed to add message: ${error.message}`);
        }
    }

    // Assign ticket to admin
    async assignTicket(ticketId, adminId) {
        try {
            const ticket = await SupportTicket.findById(ticketId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            ticket.assignedTo = adminId;
            ticket.lastActivity = new Date();

            if (ticket.status === 'Open') {
                ticket.status = 'In Progress';
            }

            await ticket.save();

            return await ticket.populate('assignedTo', 'firstName lastName email');
        } catch (error) {
            throw new Error(`Failed to assign ticket: ${error.message}`);
        }
    }

    // Close ticket
    async closeTicket(ticketId, adminId) {
        try {
            const ticket = await SupportTicket.findById(ticketId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            ticket.status = 'Closed';
            ticket.closedAt = new Date();
            ticket.lastActivity = new Date();

            await ticket.save();

            return ticket;
        } catch (error) {
            throw new Error(`Failed to close ticket: ${error.message}`);
        }
    }

    // Get ticket statistics
    async getStatistics() {
        try {
            const stats = await SupportTicket.getStatistics();

            // Get additional statistics
            const categoryStats = await SupportTicket.aggregate([
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const priorityStats = await SupportTicket.aggregate([
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const statusStats = await SupportTicket.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            return {
                ...stats,
                categoryBreakdown: categoryStats,
                priorityBreakdown: priorityStats,
                statusBreakdown: statusStats
            };
        } catch (error) {
            throw new Error(`Failed to fetch statistics: ${error.message}`);
        }
    }

    // Get tickets for a specific customer
    async getCustomerTickets(customerId, page = 1, limit = 10) {
        try {
            const filters = { customerId };
            return await this.getTickets(filters, page, limit);
        } catch (error) {
            throw new Error(`Failed to fetch customer tickets: ${error.message}`);
        }
    }

    // Search tickets
    async searchTickets(searchTerm, filters = {}, page = 1, limit = 10) {
        try {
            const searchFilters = { ...filters, search: searchTerm };
            return await this.getTickets(searchFilters, page, limit);
        } catch (error) {
            throw new Error(`Failed to search tickets: ${error.message}`);
        }
    }

    // Rate ticket satisfaction
    async rateTicket(ticketId, rating, feedback = '') {
        try {
            const ticket = await SupportTicket.findById(ticketId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            ticket.satisfactionRating = {
                rating,
                feedback,
                ratedAt: new Date()
            };

            await ticket.save();
            return ticket;
        } catch (error) {
            throw new Error(`Failed to rate ticket: ${error.message}`);
        }
    }

    // Delete ticket (soft delete by changing status to cancelled)
    async deleteTicket(ticketId) {
        try {
            const ticket = await SupportTicket.findById(ticketId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            ticket.status = 'Cancelled';
            ticket.lastActivity = new Date();

            await ticket.save();
            return ticket;
        } catch (error) {
            throw new Error(`Failed to delete ticket: ${error.message}`);
        }
    }
}

module.exports = new SupportTicketService();
