const storeService = require('../services/storeService');

class StoreController {
    // Get all stores
    async getAllStores(req, res) {
        try {
            const { status, search } = req.query;
            
            const filters = {};
            if (status) {
                filters.status = status;
            }
            if (search) {
                filters.search = search;
            }

            const stores = await storeService.getAllStores(filters);

            res.status(200).json({
                success: true,
                data: stores
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get store by ID
    async getStoreById(req, res) {
        try {
            const { id } = req.params;
            const store = await storeService.getStoreById(id);
            
            if (!store) {
                return res.status(404).json({
                    success: false,
                    message: 'Store not found'
                });
            }

            res.status(200).json({
                success: true,
                data: store
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get statistics
    async getStatistics(req, res) {
        try {
            const stats = await storeService.getStatistics();
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create a new store
    async createStore(req, res) {
        try {
            const { name, address, hours, phone, googleLink, bannerUrl, pitch, status, technicians, lat, lng } = req.body;

            if (!name || !address || !hours || !phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: name, address, hours, and phone are required'
                });
            }

            const store = await storeService.createStore({
                name,
                address,
                hours,
                phone,
                googleLink,
                bannerUrl,
                pitch,
                status,
                technicians,
                lat,
                lng
            });

            res.status(201).json({
                success: true,
                message: 'Store created successfully',
                data: store
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update store
    async updateStore(req, res) {
        try {
            const { id } = req.params;
            const { name, address, hours, phone, googleLink, bannerUrl, pitch, status, technicians, lat, lng } = req.body;

            const store = await storeService.updateStore(id, {
                name,
                address,
                hours,
                phone,
                googleLink,
                bannerUrl,
                pitch,
                status,
                technicians,
                lat,
                lng
            });

            res.status(200).json({
                success: true,
                message: 'Store updated successfully',
                data: store
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete store
    async deleteStore(req, res) {
        try {
            const { id } = req.params;
            const result = await storeService.deleteStore(id);

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

module.exports = new StoreController();

