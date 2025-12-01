const testimonialService = require('../services/testimonialService');

class TestimonialController {
    // Get all testimonials
    async getAllTestimonials(req, res) {
        try {
            const { published, search } = req.query;
            
            const filters = {};
            if (published !== undefined) {
                filters.published = published === 'true';
            }
            if (search) {
                filters.search = search;
            }

            const testimonials = await testimonialService.getAllTestimonials(filters);

            res.status(200).json({
                success: true,
                data: testimonials
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get testimonial by ID
    async getTestimonialById(req, res) {
        try {
            const { id } = req.params;
            const testimonial = await testimonialService.getTestimonialById(id);
            
            if (!testimonial) {
                return res.status(404).json({
                    success: false,
                    message: 'Testimonial not found'
                });
            }

            res.status(200).json({
                success: true,
                data: testimonial
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create a new testimonial
    async createTestimonial(req, res) {
        try {
            const { name, location, plan, rating, avatarUrl, quote, published } = req.body;

            if (!name || !location || !quote) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: name, location, and quote are required'
                });
            }

            const testimonial = await testimonialService.createTestimonial({
                name,
                location,
                plan,
                rating,
                avatarUrl,
                quote,
                published
            });

            res.status(201).json({
                success: true,
                message: 'Testimonial created successfully',
                data: testimonial
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update testimonial
    async updateTestimonial(req, res) {
        try {
            const { id } = req.params;
            const { name, location, plan, rating, avatarUrl, quote, published } = req.body;

            const testimonial = await testimonialService.updateTestimonial(id, {
                name,
                location,
                plan,
                rating,
                avatarUrl,
                quote,
                published
            });

            res.status(200).json({
                success: true,
                message: 'Testimonial updated successfully',
                data: testimonial
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete testimonial
    async deleteTestimonial(req, res) {
        try {
            const { id } = req.params;
            const result = await testimonialService.deleteTestimonial(id);

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

module.exports = new TestimonialController();

