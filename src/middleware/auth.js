const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * Middleware to require authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Missing authentication token'
        });
    }

    try {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
        const payload = jwt.verify(token, secret);

        // Fetch user details from database
        const user = await User.findById(payload.sub);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user info to request
        req.user = {
            id: user._id,
            email: user.email,
            role: user.role || 'customer', // Default role is customer
            ...user.toSafeJSON()
        };

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

/**
 * Middleware to require admin role (includes superAdmin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'superAdmin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
}

/**
 * Helper function to check if user has a specific permission
 * @param {Object} user - User object from req.user
 * @param {string} permissionKey - Permission key to check
 * @returns {Promise<boolean>} - True if user has permission
 */
async function hasPermission(user, permissionKey) {
    // SuperAdmin bypasses all permission checks
    if (user.role === 'superAdmin') {
        return true;
    }

    // Only check permissions for admin role
    if (user.role !== 'admin') {
        return false;
    }

    // Load user's role permissions
    try {
        const userDoc = await User.findById(user.id);
        if (!userDoc || !userDoc.subrole) {
            return false;
        }

        const roleDoc = await Role.findOne({ name: userDoc.subrole });
        if (!roleDoc || !roleDoc.permissions) {
            return false;
        }

        return roleDoc.permissions[permissionKey] === true;
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Middleware factory to require a specific permission
 * @param {string} permissionKey - Permission key to check
 * @returns {Function} - Express middleware function
 */
function requirePermission(permissionKey) {
    return async (req, res, next) => {
        try {
            const hasPerm = await hasPermission(req.user, permissionKey);
            if (!hasPerm) {
                return res.status(403).json({
                    success: false,
                    message: `Permission denied: ${permissionKey} required`
                });
            }
            next();
        } catch (error) {
            console.error('Error in requirePermission middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Error checking permissions'
            });
        }
    };
}

module.exports = {
    authenticateToken,
    requireAdmin,
    hasPermission,
    requirePermission
};
