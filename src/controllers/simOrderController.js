const simOrderService = require('../services/simOrderService');

class SimOrderController {
    // Get all SIM orders
    async getAllOrders(req, res) {
        try {
            const { status, search } = req.query;

            const filters = {};
            if (status) {
                filters.status = status;
            }
            if (search) {
                filters.search = search;
            }

            const orders = await simOrderService.getAllOrders(filters);

            res.status(200).json({
                success: true,
                data: orders
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get order by ID
    async getOrderById(req, res) {
        try {
            const { id } = req.params;
            const order = await simOrderService.getOrderById(id);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'SIM order not found'
                });
            }

            res.status(200).json({
                success: true,
                data: order
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create a new SIM order
    async createOrder(req, res) {
        try {
            const { orderNumber, customer, email, plan, orderDate } = req.body;

            if (!orderNumber || !customer || !email || !plan) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: orderNumber, customer, email, and plan are required'
                });
            }

            const order = await simOrderService.createOrder({
                orderNumber,
                customer,
                email,
                plan,
                orderDate
            });

            res.status(201).json({
                success: true,
                message: 'SIM order created successfully',
                data: order
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update order
    async updateOrder(req, res) {
        try {
            const { id } = req.params;
            const { customer, email, plan, orderDate } = req.body;

            const order = await simOrderService.updateOrder(id, {
                customer,
                email,
                plan,
                orderDate
            });

            res.status(200).json({
                success: true,
                message: 'SIM order updated successfully',
                data: order
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Enter ICCID
    async enterIccid(req, res) {
        try {
            const { id } = req.params;
            const { iccid } = req.body;

            if (!iccid) {
                return res.status(400).json({
                    success: false,
                    message: 'ICCID is required'
                });
            }

            const order = await simOrderService.enterIccid(id, iccid);

            res.status(200).json({
                success: true,
                message: 'ICCID entered successfully',
                data: order
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Provision order
    async provisionOrder(req, res) {
        try {
            const { id } = req.params;
            const { provisioningNotes } = req.body;

            const order = await simOrderService.provisionOrder(id, provisioningNotes);

            res.status(200).json({
                success: true,
                message: 'Order provisioned successfully',
                data: order
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete order
    async deleteOrder(req, res) {
        try {
            const { id } = req.params;
            const result = await simOrderService.deleteOrder(id);

            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new SimOrderController();

