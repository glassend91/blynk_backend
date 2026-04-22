const Store = require('../models/Store');

class StoreService {
    // Get all stores with optional filtering
    async getAllStores(filters = {}) {
        try {
            const query = { deletedAt: null }; // Only get non-deleted stores
            
            if (filters.status) {
                query.status = filters.status;
            }

            if (filters.search) {
                const searchRegex = new RegExp(filters.search, 'i');
                query.$or = [
                    { name: searchRegex },
                    { address: searchRegex },
                    { phone: searchRegex }
                ];
            }

            const stores = await Store.find(query)
                .sort({ createdAt: -1 })
                .lean();

            return stores.map(s => ({
                id: s._id.toString(),
                name: s.name,
                address: s.address,
                hours: s.hours,
                phone: s.phone,
                lat: s.lat,
                lng: s.lng,
                googleLink: s.googleLink || undefined,
                bannerUrl: s.bannerUrl || undefined,
                pitch: s.pitch || undefined,
                status: s.status,
                technicians: s.technicians.map(t => ({
                    id: t._id.toString(),
                    fullName: t.fullName,
                    roleTitle: t.roleTitle || undefined,
                    years: t.years || undefined,
                    specialties: t.specialties || undefined,
                    videoUrl: t.videoUrl || undefined,
                    bio: t.bio || undefined,
                    photoUrl: t.photoUrl || undefined
                })),
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString()
            }));
        } catch (error) {
            throw new Error(`Failed to fetch stores: ${error.message}`);
        }
    }

    // Get store by ID
    async getStoreById(id) {
        try {
            const store = await Store.findOne({ _id: id, deletedAt: null });
            if (!store) {
                return null;
            }
            return store.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to fetch store: ${error.message}`);
        }
    }

    // Create a new store
    async createStore(data) {
        try {
            const { name, address, hours, phone, googleLink, bannerUrl, pitch, status, technicians, lat, lng } = data;

            if (!name || !address || !hours || !phone) {
                throw new Error('Missing required fields: name, address, hours, and phone are required');
            }

            const store = new Store({
                name: name.trim(),
                address: address.trim(),
                hours: hours.trim(),
                phone: phone.trim(),
                googleLink: googleLink ? googleLink.trim() : '',
                bannerUrl: bannerUrl ? bannerUrl.trim() : '',
                pitch: pitch ? pitch.trim() : '',
                status: status || 'Active',
                lat: lat !== undefined ? Number(lat) : undefined,
                lng: lng !== undefined ? Number(lng) : undefined,
                technicians: technicians ? technicians.map(t => ({
                    fullName: t.fullName.trim(),
                    roleTitle: t.roleTitle ? t.roleTitle.trim() : '',
                    years: t.years ? t.years.trim() : '',
                    specialties: t.specialties ? t.specialties.trim() : '',
                    videoUrl: t.videoUrl ? t.videoUrl.trim() : '',
                    bio: t.bio ? t.bio.trim() : '',
                    photoUrl: t.photoUrl ? t.photoUrl.trim() : ''
                })) : []
            });

            await store.save();
            return store.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to create store: ${error.message}`);
        }
    }

    // Update store
    async updateStore(id, data) {
        try {
            const { name, address, hours, phone, googleLink, bannerUrl, pitch, status, technicians, lat, lng } = data;

            const updateData = {};
            if (name !== undefined) updateData.name = name.trim();
            if (address !== undefined) updateData.address = address.trim();
            if (hours !== undefined) updateData.hours = hours.trim();
            if (phone !== undefined) updateData.phone = phone.trim();
            if (googleLink !== undefined) updateData.googleLink = googleLink ? googleLink.trim() : '';
            if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl ? bannerUrl.trim() : '';
            if (pitch !== undefined) updateData.pitch = pitch ? pitch.trim() : '';
            if (status !== undefined) updateData.status = status;
            if (lat !== undefined) updateData.lat = Number(lat);
            if (lng !== undefined) updateData.lng = Number(lng);
            if (technicians !== undefined) {
                updateData.technicians = technicians.map(t => ({
                    fullName: t.fullName.trim(),
                    roleTitle: t.roleTitle ? t.roleTitle.trim() : '',
                    years: t.years ? t.years.trim() : '',
                    specialties: t.specialties ? t.specialties.trim() : '',
                    videoUrl: t.videoUrl ? t.videoUrl.trim() : '',
                    bio: t.bio ? t.bio.trim() : '',
                    photoUrl: t.photoUrl ? t.photoUrl.trim() : ''
                }));
            }

            const store = await Store.findOneAndUpdate(
                { _id: id, deletedAt: null },
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!store) {
                throw new Error('Store not found');
            }

            return store.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update store: ${error.message}`);
        }
    }

    // Soft delete store
    async deleteStore(id) {
        try {
            const store = await Store.findOneAndUpdate(
                { _id: id, deletedAt: null },
                { $set: { deletedAt: new Date() } },
                { new: true }
            );
            if (!store) {
                throw new Error('Store not found');
            }
            return { success: true, message: 'Store deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete store: ${error.message}`);
        }
    }

    // Get statistics
    async getStatistics() {
        try {
            const baseQuery = { deletedAt: null };
            const totalStores = await Store.countDocuments(baseQuery);
            const activeStores = await Store.countDocuments({ ...baseQuery, status: 'Active' });
            const inactiveStores = await Store.countDocuments({ ...baseQuery, status: 'Inactive' });
            
            // Count total technicians across all non-deleted stores
            const stores = await Store.find(baseQuery, 'technicians');
            const totalTechnicians = stores.reduce((sum, store) => sum + (store.technicians?.length || 0), 0);

            return {
                totalStores,
                activeStores,
                inactiveStores,
                totalTechnicians
            };
        } catch (error) {
            throw new Error(`Failed to fetch statistics: ${error.message}`);
        }
    }
}

module.exports = new StoreService();

