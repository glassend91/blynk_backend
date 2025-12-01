const customerPlansService = require('../services/customerPlansService');

class CustomerPlansController {
    // Search customer and get their plans
    async searchCustomerPlans(req, res) {
        try {
            const { query } = req.query;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            const result = await customerPlansService.searchCustomerPlans(query);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get plans for a specific customer
    async getCustomerPlans(req, res) {
        try {
            const { customerId } = req.params;

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID is required'
                });
            }

            const result = await customerPlansService.getCustomerPlans(customerId);

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Add service to customer
    async addServiceToCustomer(req, res) {
        try {
            const { customerId, serviceId, assignedAddress, assignedNumber } = req.body;

            if (!customerId || !serviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID and Service ID are required'
                });
            }

            const subscription = await customerPlansService.addServiceToCustomer(
                customerId,
                serviceId,
                assignedAddress,
                assignedNumber
            );

            res.status(201).json({
                success: true,
                message: 'Service added to customer successfully',
                data: {
                    subscriptionId: subscription._id.toString()
                }
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get available services
    async getAvailableServices(req, res) {
        try {
            const services = await customerPlansService.getAvailableServices();

            res.status(200).json({
                success: true,
                data: services
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new CustomerPlansController();

