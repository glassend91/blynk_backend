const WebsiteContent = require('../models/WebsiteContent');

class WebsiteContentService {
    // Get all website content pages
    async getAllPages() {
        try {
            const pages = await WebsiteContent.find({ deletedAt: null }).sort({ pageKey: 1 });
            return pages.map(page => page.toSafeJSON());
        } catch (error) {
            throw new Error(`Failed to fetch website content: ${error.message}`);
        }
    }

    // Get content for a specific page
    async getPageContent(pageKey) {
        try {
            const content = await WebsiteContent.findOne({ pageKey, deletedAt: null });
            if (!content) {
                return null;
            }
            return content.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to fetch page content: ${error.message}`);
        }
    }

    // Create or update page content
    async upsertPageContent(pageKey, data) {
        try {
            const { hero, features, seo } = data;

            // Validate required fields
            if (!hero || !features || !seo) {
                throw new Error('Missing required fields: hero, features, and seo are required');
            }

            const content = await WebsiteContent.findOneAndUpdate(
                { pageKey, deletedAt: null },
                {
                    pageKey,
                    hero: {
                        headline: hero.headline || '',
                        subtitle: hero.subtitle || ''
                    },
                    features: {
                        title: features.title || '',
                        subtitle: features.subtitle || ''
                    },
                    seo: {
                        metaTitle: seo.metaTitle || '',
                        metaDescription: seo.metaDescription || '',
                        keywords: seo.keywords || ''
                    },
                    deletedAt: null // Ensure it's not deleted when upserting
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return content.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to save page content: ${error.message}`);
        }
    }

    // Update specific block (hero, features, or seo) for a page
    async updateBlock(pageKey, blockType, blockData) {
        try {
            const validBlockTypes = ['hero', 'features', 'seo'];
            if (!validBlockTypes.includes(blockType)) {
                throw new Error(`Invalid block type. Must be one of: ${validBlockTypes.join(', ')}`);
            }

            const updateField = {};
            updateField[blockType] = blockData;

            const content = await WebsiteContent.findOneAndUpdate(
                { pageKey, deletedAt: null },
                { 
                    $set: {
                        ...updateField,
                        deletedAt: null // Ensure it's not deleted when upserting
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return content.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update ${blockType} block: ${error.message}`);
        }
    }

    // Soft delete page content
    async deletePageContent(pageKey) {
        try {
            const result = await WebsiteContent.findOneAndUpdate(
                { pageKey, deletedAt: null },
                { $set: { deletedAt: new Date() } },
                { new: true }
            );
            if (!result) {
                throw new Error(`Page content for ${pageKey} not found`);
            }
            return { success: true, message: `Page content for ${pageKey} deleted successfully` };
        } catch (error) {
            throw new Error(`Failed to delete page content: ${error.message}`);
        }
    }
}

module.exports = new WebsiteContentService();

