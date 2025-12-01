const dashboardService = require('../services/dashboardService');
const User = require('../models/User');
const Role = require('../models/Role');

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
}

module.exports = new DashboardController();
