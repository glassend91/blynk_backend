const websiteContentService = require('../services/websiteContentService');
const User = require('../models/User');
const Role = require('../models/Role');

class WebsiteContentController {
    // Get all website content pages
    async getAllPages(req, res) {
        try {
            const pages = await websiteContentService.getAllPages();
            res.status(200).json({
                success: true,
                data: pages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get content for a specific page
    async getPageContent(req, res) {
        try {
            const { pageKey } = req.params;
            const content = await websiteContentService.getPageContent(pageKey);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    message: `Content for page '${pageKey}' not found`
                });
            }

            res.status(200).json({
                success: true,
                data: content
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create or update entire page content
    async upsertPageContent(req, res) {
        try {
            const { pageKey } = req.params;
            const { hero, features, seo } = req.body;

            // Check permission for SEO updates if seo is provided
            if (seo) {
                // SuperAdmin bypasses permission checks
                if (req.user.role !== 'superAdmin') {
                    const currentUser = await User.findById(req.user.id);
                    if (currentUser && currentUser.subrole) {
                        const roleDoc = await Role.findOne({ name: currentUser.subrole });
                        if (roleDoc && roleDoc.permissions) {
                            const hasSeoPermission = roleDoc.permissions['seo.manage'] === true;
                            if (!hasSeoPermission) {
                                return res.status(403).json({
                                    success: false,
                                    message: 'You do not have permission to manage SEO settings'
                                });
                            }
                        }
                    }
                }
            }

            if (!hero || !features || !seo) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: hero, features, and seo are required'
                });
            }

            const content = await websiteContentService.upsertPageContent(pageKey, {
                hero,
                features,
                seo
            });

            res.status(200).json({
                success: true,
                message: `Page content for '${pageKey}' saved successfully`,
                data: content
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update specific block (hero, features, or seo)
    async updateBlock(req, res) {
        try {
            const { pageKey, blockType } = req.params;
            const blockData = req.body;

            // Check permission for SEO updates
            if (blockType === 'seo') {
                // SuperAdmin bypasses permission checks
                if (req.user.role !== 'superAdmin') {
                    const currentUser = await User.findById(req.user.id);
                    if (currentUser && currentUser.subrole) {
                        const roleDoc = await Role.findOne({ name: currentUser.subrole });
                        if (roleDoc && roleDoc.permissions) {
                            const hasSeoPermission = roleDoc.permissions['seo.manage'] === true;
                            if (!hasSeoPermission) {
                                return res.status(403).json({
                                    success: false,
                                    message: 'You do not have permission to manage SEO settings'
                                });
                            }
                        }
                    }
                }
            }

            const content = await websiteContentService.updateBlock(pageKey, blockType, blockData);

            res.status(200).json({
                success: true,
                message: `${blockType} block for '${pageKey}' updated successfully`,
                data: content
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete page content
    async deletePageContent(req, res) {
        try {
            const { pageKey } = req.params;
            const result = await websiteContentService.deletePageContent(pageKey);

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

module.exports = new WebsiteContentController();

