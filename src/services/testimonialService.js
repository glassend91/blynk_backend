const Testimonial = require('../models/Testimonial');

class TestimonialService {
    // Get all testimonials with optional filtering
    async getAllTestimonials(filters = {}) {
        try {
            const query = { deletedAt: null }; // Only get non-deleted testimonials
            
            if (filters.published !== undefined) {
                query.published = filters.published;
            }

            if (filters.search) {
                const searchRegex = new RegExp(filters.search, 'i');
                query.$or = [
                    { name: searchRegex },
                    { location: searchRegex },
                    { quote: searchRegex },
                    { plan: searchRegex }
                ];
            }

            const testimonials = await Testimonial.find(query)
                .sort({ createdAt: -1 })
                .lean();

            return testimonials.map(t => ({
                id: t._id.toString(),
                name: t.name,
                location: t.location,
                plan: t.plan || undefined,
                rating: t.rating,
                avatarUrl: t.avatarUrl || undefined,
                quote: t.quote,
                published: t.published,
                createdAt: t.createdAt.toISOString()
            }));
        } catch (error) {
            throw new Error(`Failed to fetch testimonials: ${error.message}`);
        }
    }

    // Get testimonial by ID
    async getTestimonialById(id) {
        try {
            const testimonial = await Testimonial.findOne({ _id: id, deletedAt: null });
            if (!testimonial) {
                return null;
            }
            return testimonial.toSafeJSON();
        } catch (error) {
            throw new Error(`Failed to fetch testimonial: ${error.message}`);
        }
    }

    // Create a new testimonial
    async createTestimonial(data) {
        try {
            const { name, location, plan, rating, avatarUrl, quote, published } = data;

            if (!name || !location || !quote) {
                throw new Error('Missing required fields: name, location, and quote are required');
            }

            if (!rating || rating < 1 || rating > 5) {
                throw new Error('Rating must be between 1 and 5');
            }

            const testimonial = new Testimonial({
                name: name.trim(),
                location: location.trim(),
                plan: plan ? plan.trim() : '',
                rating,
                avatarUrl: avatarUrl ? avatarUrl.trim() : '',
                quote: quote.trim(),
                published: published !== undefined ? published : true
            });

            await testimonial.save();
            return testimonial.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to create testimonial: ${error.message}`);
        }
    }

    // Update testimonial
    async updateTestimonial(id, data) {
        try {
            const { name, location, plan, rating, avatarUrl, quote, published } = data;

            const updateData = {};
            if (name !== undefined) updateData.name = name.trim();
            if (location !== undefined) updateData.location = location.trim();
            if (plan !== undefined) updateData.plan = plan ? plan.trim() : '';
            if (rating !== undefined) {
                if (rating < 1 || rating > 5) {
                    throw new Error('Rating must be between 1 and 5');
                }
                updateData.rating = rating;
            }
            if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl ? avatarUrl.trim() : '';
            if (quote !== undefined) updateData.quote = quote.trim();
            if (published !== undefined) updateData.published = published;

            const testimonial = await Testimonial.findOneAndUpdate(
                { _id: id, deletedAt: null },
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!testimonial) {
                throw new Error('Testimonial not found');
            }

            return testimonial.toSafeJSON();
        } catch (error) {
            if (error.name === 'ValidationError') {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to update testimonial: ${error.message}`);
        }
    }

    // Soft delete testimonial
    async deleteTestimonial(id) {
        try {
            const testimonial = await Testimonial.findOneAndUpdate(
                { _id: id, deletedAt: null },
                { $set: { deletedAt: new Date() } },
                { new: true }
            );
            if (!testimonial) {
                throw new Error('Testimonial not found');
            }
            return { success: true, message: 'Testimonial deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete testimonial: ${error.message}`);
        }
    }
}

module.exports = new TestimonialService();

