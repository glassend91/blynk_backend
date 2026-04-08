const SimOrder = require('../models/SimOrder');

class SimOrderService {
    // Get all SIM orders with optional filtering
    async getAllOrders(filters = {}) {
        try {
            const query = { deletedAt: null }; // Only get non-deleted orders

            if (filters.status) {
                query.status = filters.status;
            }

            if (filters.search) {
                const searchRegex = new RegExp(filters.search, 'i');
                query.$or = [
                    { orderNumber: searchRegex },
                    { customer: searchRegex },
                    { email: searchRegex },
                    { plan: searchRegex }
                ];
            }

            const orders = await SimOrder.find(query)
                .sort({ orderDate: -1, createdAt: -1 })
                .lean();

            return orders.map(o => ({
                id: o._id.toString(),
                orderNumber: o.orderNumber,
                customer: o.customer,
                email: o.email,
                plan: o.plan,
                status: o.status,
                orderDate: o.orderDate.toISOString().split('T')[0],
                iccid: o.iccid || undefined,
                provisioningNotes: o.provisioningNotes || undefined,
                provisionedAt: o.provisionedAt ? o.provisionedAt.toISOString() : undefined,
                createdAt: o.createdAt.toISOString(),
                updatedAt: o.updatedAt.toISOString()
            }));
        } catch (error) {
            throw new Error(`Failed to fetch SIM orders: ${error.message}`);
        }
    }

    // Get order by ID
    async getOrderById(id) {
        try {
            const order = await SimOrder.findOne({ _id: id, deletedAt: null });
            if (!order) {
                return null;
            }
            return order.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to fetch SIM order: ${error.message}`);
        }
    }

    // Get order by order number
    async getOrderByOrderNumber(orderNumber) {
        try {
            const order = await SimOrder.findOne({ orderNumber, deletedAt: null });
            if (!order) {
                return null;
            }
            return order.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to fetch SIM order: ${error.message}`);
        }
    }

    // Create a new SIM order
    async createOrder(data) {
        try {
            const { orderNumber, customer, email, plan, orderDate } = data;

            if (!orderNumber || !customer || !email || !plan) {
                throw new Error('Missing required fields: orderNumber, customer, email, and plan are required');
            }

            // Check if order number already exists
            const existing = await SimOrder.findOne({ orderNumber, deletedAt: null });
            if (existing) {
                throw new Error('Order number already exists');
            }

            const order = new SimOrder({
                orderNumber: orderNumber.trim(),
                customer: customer.trim(),
                email: email.trim().toLowerCase(),
                plan: plan.trim(),
                orderDate: orderDate ? new Date(orderDate) : new Date(),
                status: 'Pending ICCID'
            });

            await order.save();
            return order.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to create SIM order: ${error.message}`);
        }
    }

    // Update order
    async updateOrder(id, data) {
        try {
            const { customer, email, plan, orderDate } = data;

            const updateData = {};
            if (customer !== undefined) updateData.customer = customer.trim();
            if (email !== undefined) updateData.email = email.trim().toLowerCase();
            if (plan !== undefined) updateData.plan = plan.trim();
            if (orderDate !== undefined) updateData.orderDate = new Date(orderDate);

            const order = await SimOrder.findOneAndUpdate(
                { _id: id, deletedAt: null },
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!order) {
                throw new Error('SIM order not found');
            }

            return order.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update SIM order: ${error.message}`);
        }
    }

    // Enter ICCID for an order
    async enterIccid(id, iccid) {
        try {
            if (!iccid || !iccid.trim()) {
                throw new Error('ICCID is required');
            }

            const order = await SimOrder.findOne({ _id: id, deletedAt: null });
            if (!order) {
                throw new Error('SIM order not found');
            }

            if (order.status !== 'Pending ICCID') {
                throw new Error(`Cannot enter ICCID for order with status: ${order.status}`);
            }

            // Check if ICCID is already used
            const existingOrder = await SimOrder.findOne({
                iccid: iccid.trim(),
                deletedAt: null,
                _id: { $ne: id }
            });
            if (existingOrder) {
                throw new Error('ICCID is already assigned to another order');
            }

            order.iccid = iccid.trim();
            order.status = 'Awaiting Provisioning';
            await order.save();

            return order.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to enter ICCID: ${error.message}`);
        }
    }

    // Provision an order
    async provisionOrder(id, provisioningNotes) {
        try {
            const order = await SimOrder.findOne({ _id: id, deletedAt: null });
            if (!order) {
                throw new Error('SIM order not found');
            }

            if (order.status === 'Provisioned') {
                throw new Error('Order is already provisioned');
            }

            if (!order.iccid) {
                throw new Error('ICCID must be entered before provisioning');
            }

            order.status = 'Provisioned';
            order.provisionedAt = new Date();
            if (provisioningNotes) {
                order.provisioningNotes = provisioningNotes.trim();
            }
            await order.save();

            return order.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to provision order: ${error.message}`);
        }
    }

    // Soft delete order
    async deleteOrder(id) {
        try {
            const order = await SimOrder.findOneAndUpdate(
                { _id: id, deletedAt: null },
                { $set: { deletedAt: new Date() } },
                { new: true }
            );
            if (!order) {
                throw new Error('SIM order not found');
            }
            return { success: true, message: 'SIM order deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete SIM order: ${error.message}`);
        }
    }
}

module.exports = new SimOrderService();

