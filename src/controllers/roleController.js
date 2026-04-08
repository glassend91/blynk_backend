const Role = require('../models/Role');

class RoleController {
    // GET /api/roles
    async listRoles(req, res) {
        try {
            const roles = await Role.find().sort({ createdAt: -1 });
            res.status(200).json({
                success: true,
                data: {
                    roles: roles.map((r) => r.toSafeJSON())
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
            const { name, description, usersCount, badge, permissions } = req.body;

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
                permissions: permissions || {}
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
            const { name, description, usersCount, badge, permissions } = req.body;

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
}

module.exports = new RoleController();


