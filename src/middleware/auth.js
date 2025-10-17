const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
 * Middleware to require admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    requireAdmin
};
