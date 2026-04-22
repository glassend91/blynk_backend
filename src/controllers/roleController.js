const Role = require('../models/Role');
const User = require('../models/User');

class RoleController {
    // GET /api/roles
    async listRoles(req, res) {
        try {
            const roles = await Role.find().sort({ createdAt: -1 });

            // Calculate dynamic counts for each role
            const rolesWithCounts = await Promise.all(
                roles.map(async (role) => {
                    const count = await User.countDocuments({
                        $or: [{ subrole: role.name }, { adminRoleLabel: role.name }],
                        isDeleted: { $ne: true }
                    });

                    const roleData = role.toSafeJSON();
                    roleData.usersCount = count;
                    return roleData;
                })
            );

            res.status(200).json({
                success: true,
                data: {
                    roles: rolesWithCounts
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // POST /api/roles
    async createRole(req, res) {
        try {
            const { name, description, usersCount, badge, permissions, monthlyCreditLimit } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name is required'
                });
            }

            const role = new Role({
                name,
                description: description || '',
                usersCount: usersCount || 0,
                badge,
                permissions: permissions || {},
                monthlyCreditLimit: monthlyCreditLimit || 0
            });

            const saved = await role.save();

            res.status(201).json({
                success: true,
                message: 'Role created successfully',
                data: saved.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // PUT /api/roles/:id
    async updateRole(req, res) {
        try {
            const { id } = req.params;
            const { name, description, usersCount, badge, permissions, monthlyCreditLimit } = req.body;

            const role = await Role.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            if (typeof name === 'string') role.name = name;
            if (typeof description === 'string') role.description = description;
            if (typeof usersCount === 'number') role.usersCount = usersCount;
            if (typeof badge !== 'undefined') role.badge = badge;
            if (permissions && typeof permissions === 'object') {
                role.permissions = permissions;
            }
            if (typeof monthlyCreditLimit === 'number') {
                role.monthlyCreditLimit = monthlyCreditLimit;
            }

            const saved = await role.save();

            res.status(200).json({
                success: true,
                message: 'Role updated successfully',
                data: saved.toSafeJSON()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // DELETE /api/roles/:id
    async deleteRole(req, res) {
        try {
            const { id } = req.params;

            const role = await Role.findByIdAndDelete(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Role deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // GET /api/roles/:id/users
    async listUsersForRole(req, res) {
        try {
            const { id } = req.params;
            const role = await Role.findById(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            // Find users where subrole or adminRoleLabel matches the role name
            const users = await User.find({
                $or: [
                    { subrole: role.name },
                    { adminRoleLabel: role.name }
                ],
                isDeleted: { $ne: true }
            }).select('firstName lastName email status role subrole adminRoleLabel createdAt');

            const formattedUsers = users.map(u => ({
                id: u._id,
                name: `${u.firstName} ${u.lastName}`.trim() || u.email,
                email: u.email,
                status: u.status,
                role: u.subrole || u.adminRoleLabel || u.role,
                created: u.createdAt ? u.createdAt.toISOString().slice(0, 10) : ''
            }));

            res.status(200).json({
                success: true,
                data: {
                    users: formattedUsers
                }
            });
        } catch (error) {
            console.error('Error listing users for role:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new RoleController();


