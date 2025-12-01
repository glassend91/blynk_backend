const User = require('../models/User');
const Service = require('../models/Service');
const SimOrder = require('../models/SimOrder');
const SupportTicket = require('../models/SupportTicket');

class DashboardService {
  // Load overview metrics and lists for admin dashboard
  async getOverview() {
    try {
      const [totalUsers, activeServices, pendingOrders, openTickets] = await Promise.all([
        User.countDocuments({ isDeleted: false }),
        Service.countDocuments({ isActive: true, isAvailable: true }),
        SimOrder.countDocuments({
          status: { $in: ['Pending ICCID', 'Awaiting Provisioning'] },
          deletedAt: null,
        }),
        SupportTicket.countDocuments({ status: { $in: ['Open', 'In Progress'] } }),
      ]);

      const kpi = [
        {
          title: 'Total Users',
          value: totalUsers,
          delta: '+0% from last month',
          trend: 'up',
          icon: 'user',
        },
        {
          title: 'Active Services',
          value: activeServices,
          delta: '+0% from last month',
          trend: 'up',
          icon: 'box',
        },
        {
          title: 'Pending Orders',
          value: pendingOrders,
          delta: '+0% from last month',
          trend: pendingOrders > 0 ? 'up' : 'down',
          icon: 'card',
        },
        {
          title: 'Open Tickets',
          value: openTickets,
          delta: '+0% from last month',
          trend: openTickets > 0 ? 'up' : 'down',
          icon: 'headset',
        },
      ];

      const [recentUsers, recentSimOrders, recentTickets] = await Promise.all([
        User.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5).lean(),
        SimOrder.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(5).lean(),
        SupportTicket.find({}).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

      const rawActivity = [
        ...recentUsers.map((u) => ({
          title: 'New user registration',
          by: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Customer',
          time: u.createdAt,
        })),
        ...recentSimOrders.map((o) => ({
          title: `SIM order ${o.orderNumber} created`,
          by: o.customer,
          time: o.createdAt,
        })),
        ...recentTickets.map((t) => ({
          title: `Support ticket: ${t.subject}`,
          by: 'Customer',
          time: t.createdAt,
        })),
      ];

      const activity = rawActivity
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 8)
        .map((item) => ({
          title: item.title,
          by: item.by,
          time: item.time,
        }));

      const tasks = [
        'Review pending SIM orders',
        'Verify new customer applications',
        'Review open support tickets',
        'Check active service utilisation',
      ];

      const actions = [
        { label: 'Add User', icon: 'user', path: '/admin/user-management' },
        { label: 'New Service Plan', icon: 'box', path: '/admin/service-plans' },
        { label: 'Verify Customer', icon: 'profile', path: '/admin/customer-verification' },
        { label: 'Process SIM Order', icon: 'sim', path: '/admin/sim-orders' },
      ];

      return {
        kpi,
        activity,
        tasks,
        actions,
      };
    } catch (error) {
      throw new Error(`Failed to load dashboard: ${error.message}`);
    }
  }
}

module.exports = new DashboardService();
