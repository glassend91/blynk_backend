const dashboardService = require('../services/dashboardService');
const User = require('../models/User');
const Role = require('../models/Role');
const ServiceSubscription = require('../models/ServiceSubscription');
const Invoice = require('../models/Invoice');
const SupportTicket = require('../models/SupportTicket');
const BillingAccount = require('../models/BillingAccount');
const Service = require('../models/Service');

class DashboardController {
  async getOverview(req, res) {
    try {
      // Check if user has permission to view analytics/dashboard
      // SuperAdmin bypasses permission checks
      if (req.user.role !== 'superAdmin') {
        const currentUser = await User.findById(req.user.id);
        if (currentUser && currentUser.subrole) {
          const roleDoc = await Role.findOne({ name: currentUser.subrole });
          if (roleDoc && roleDoc.permissions) {
            const hasAnalyticsPermission = roleDoc.permissions['analytics.view'] === true;
            if (!hasAnalyticsPermission) {
              return res.status(403).json({
                success: false,
                message: 'You do not have permission to view analytics'
              });
            }
          }
        }
      }

      const data = await dashboardService.getOverview();
      res.status(200).json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Customer-facing dashboard summary
  async getCustomerOverview(req, res) {
    try {
      const userId = req.user.id;

      // Active subscriptions
      const subscriptions = await ServiceSubscription.find({
        userId,
        subscriptionStatus: { $in: ['active', 'pending'] }
      }).populate('serviceId').sort({ subscribedAt: -1 }).lean();

      // Map active services for UI
      const activeServices = subscriptions.map(s => ({
        id: s._id,
        serviceName: s.serviceId?.serviceName || s.serviceId?.name || 'Service',
        serviceType: s.serviceId?.serviceType || null,
        price: s.subscriptionPrice || s.serviceId?.price || 0,
        status: s.subscriptionStatus,
        subscribedAt: s.subscribedAt,
        expiresAt: s.expiresAt,
        assignedNumber: s.assignedNumber
      }));

      // Mobile usage summary (aggregate across mobile/data subscriptions)
      const mobileSubscriptions = subscriptions.filter(s => ['Mobile', 'Data Only', 'Voice Only'].includes(s.serviceId?.serviceType));
      const mobileUsage = mobileSubscriptions.map(s => ({
        subscriptionId: s._id,
        serviceName: s.serviceId?.serviceName,
        totalUsed: s.usageData?.totalUsed || 0,
        lastUsageUpdate: s.usageData?.lastUsageUpdate || null,
        allowance: s.serviceId?.specifications?.dataAllowance || null
      }));

      // Upcoming bills - unpaid / sent / overdue
      const upcomingBills = await Invoice.find({
        customerId: userId,
        status: { $in: ['sent', 'overdue', 'draft'] }
      }).sort({ dueDate: 1 }).limit(6).select('invoiceNumber status total dueDate createdAt');

      // Recent invoices
      const recentInvoices = await Invoice.find({ customerId: userId }).sort({ createdAt: -1 }).limit(5).select('invoiceNumber status total dueDate createdAt');

      // Recent support tickets
      const recentTickets = await SupportTicket.find({ customer: userId }).sort({ updatedAt: -1 }).limit(5).select('subject status category lastActivity createdAt');

      // Billing summary
      let billingAccount = await BillingAccount.findOne({ customerId: userId }).lean();
      if (!billingAccount) {
        billingAccount = null;
      }

      // Quick actions
      const quickActions = [
        { label: 'Pay Bill', path: '/dashboard/billing' },
        { label: 'Report Issue', path: '/dashboard/tickets' },
        { label: 'Add Service', path: '/dashboard/services' }
      ];

      res.json({
        success: true,
        data: {
          activeServices,
          mobileUsage,
          upcomingBills,
          recentInvoices,
          recentTickets,
          billingAccount,
          quickActions
        }
      });
    } catch (error) {
      console.error('Error loading customer dashboard overview:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new DashboardController();
