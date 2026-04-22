const customerVerificationService = require('../services/customerVerificationService');

class CustomerVerificationController {
    // Send OTP
    async sendOTP(req, res) {
        try {
            const { emailOrPhone, channel, purpose } = req.body;

            if (!emailOrPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Email or phone number is required'
                });
            }

            const result = await customerVerificationService.sendOTP(emailOrPhone, channel, purpose, req.user.id);

            res.status(200).json({
                success: true,
                message: result.message,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Verify OTP manually
    async verifyOTP(req, res) {
        try {
            const { emailOrPhone, otpCode, adminNotes } = req.body;
            const adminId = req.user.id;

            if (!emailOrPhone || !otpCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Email/phone and OTP code are required'
                });
            }

            const verification = await customerVerificationService.verifyOTP(
                emailOrPhone,
                otpCode,
                adminNotes,
                adminId
            );

            res.status(200).json({
                success: true,
                message: 'Customer verified successfully',
                data: verification
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Manual verification
    async manualVerification(req, res) {
        try {
            const { customerIdOrEmail, adminNotes } = req.body;
            const adminId = req.user.id;

            if (!customerIdOrEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID or email is required'
                });
            }

            const verification = await customerVerificationService.manualVerification(
                customerIdOrEmail,
                adminNotes,
                adminId
            );

            res.status(200).json({
                success: true,
                message: 'Customer verified manually',
                data: verification
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get statistics
    async getStatistics(req, res) {
        try {
            const stats = await customerVerificationService.getStatistics();

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

    // Create customer note
    async createCustomerNote(req, res) {
        try {
            const { customerId, noteType, priority, content, tags, isCritical } = req.body;
            const createdBy = req.user.id;

            if (!customerId || !content) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: customerId and content are required'
                });
            }

            const note = await customerVerificationService.createCustomerNote({
                customerId,
                noteType,
                priority,
                content,
                tags,
                isCritical,
                createdBy
            });

            res.status(201).json({
                success: true,
                message: 'Customer note created successfully',
                data: note
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get customer notes
    async getCustomerNotes(req, res) {
        try {
            const { customerId } = req.params;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID is required'
                });
            }

            const notes = await customerVerificationService.getCustomerNotes(customerId);

            res.status(200).json({
                success: true,
                data: notes
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Search customers and get their notes
    async searchCustomersAndNotes(req, res) {
        try {
            const { query } = req.query;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            const notes = await customerVerificationService.searchCustomersAndNotes(query);

            res.status(200).json({
                success: true,
                data: notes
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get all notes (recent interactions)
    async getAllNotes(req, res) {
        try {
            const { customerId, noteType, search, limit } = req.query;

            const filters = {};
            if (customerId) filters.customerId = customerId;
            if (noteType) filters.noteType = noteType;
            if (search) filters.search = search;
            if (limit) filters.limit = parseInt(limit);

            const notes = await customerVerificationService.getAllNotes(filters);

            res.status(200).json({
                success: true,
                data: notes
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Global customer search - searches across all customer fields
    async globalCustomerSearch(req, res) {
        try {
            const { query } = req.query;

            if (!query || !query.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            const customers = await customerVerificationService.globalCustomerSearch(query);

            res.status(200).json({
                success: true,
                data: customers,
                count: customers.length
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get customer financial data
    async getCustomerFinancialData(req, res) {
        try {
            const { customerId } = req.params;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID is required'
                });
            }

            const financialData = await customerVerificationService.getCustomerFinancialData(customerId);

            res.status(200).json({
                success: true,
                data: financialData
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get authorised representatives
    async getAuthorisedReps(req, res) {
        try {
            const { customerId } = req.params;
            const reps = await customerVerificationService.getAuthorisedReps(customerId);
            res.status(200).json({ success: true, data: reps });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // Add authorised representative
    async addAuthorisedRep(req, res) {
        try {
            const { customerId } = req.params;
            const repData = req.body;
            const reps = await customerVerificationService.addAuthorisedRep(customerId, repData);
            res.status(201).json({ success: true, message: 'Authorised representative added successfully', data: reps });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // Update authorised representative
    async updateAuthorisedRep(req, res) {
        try {
            const { customerId, repId } = req.params;
            const repData = req.body;
            const reps = await customerVerificationService.updateAuthorisedRep(customerId, repId, repData);
            res.status(200).json({ success: true, message: 'Authorised representative updated successfully', data: reps });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // Remove authorised representative
    async removeAuthorisedRep(req, res) {
        try {
            const { customerId, repId } = req.params;
            const reps = await customerVerificationService.removeAuthorisedRep(customerId, repId);
            res.status(200).json({ success: true, message: 'Authorised representative removed successfully', data: reps });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
}

module.exports = new CustomerVerificationController();

