const wholesalerService = require('../services/wholesalerService');
const Service = require('../models/Service');
const User = require('../models/User');
const WholesalerPlan = require('../models/WholesalerPlan');

const wholesalerPlanController = {
    // Fetch all plans
    getAllPlans: async (req, res) => {
        try {
            const plans = await WholesalerPlan.find().sort({ createdAt: -1 }).lean();

            // Map to include linked retail plans count
            const plansWithStats = await Promise.all(plans.map(async (plan) => {
                const retailCount = await Service.countDocuments({ wholesalerPlanId: plan._id });
                return { ...plan, retailCount };
            }));

            res.status(200).json({ success: true, data: plansWithStats });
        } catch (error) {
            console.error('Error fetching wholesaler plans:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch wholesaler plans',
                error: error.message
            });
        }
    },

    // Create a manual wholesaler plan (e.g. NBN)
    createPlan: async (req, res) => {
        try {
            const { label, bandwidth_id, speed, type, custom_name, price, features, publish, visibilityStatus } = req.body;

            const newPlan = await WholesalerPlan.create({
                label,
                bandwidth_id,
                speed,
                type: type || 'nbn',
                custom_name,
                price,
                features,
                isPublish: !!publish,
                connection_type_name: type === 'nbn' ? 'NBN' : 'Mobile'
            });

            console.log(newPlan);

            // If publish is requested (either to public or internal), create a retail Service plan
            // if (publish) {
            //     // Find an admin to be the provider
            //     const admin = await User.findOne({ role: 'admin' || 'superAdmin' });
            //     if (!admin) {
            //         throw new Error('Default administrator not found for service creation');
            //     }

            //     await Service.create({
            //         serviceName: custom_name || label,
            //         serviceType: type === 'nbn' ? 'NBN' : 'Mobile',
            //         wholesalerPlanId: newPlan._id, // Link to the wholesaler plan record ID
            //         price: price || 0,
            //         visibilityStatus: visibilityStatus || 'internal',
            //         providerId: admin._id,
            //         specifications: {
            //             network: 'ConnectTel',
            //             dataAllowance: 'Unlimited',
            //             // Speed is stored as string like "50/20"
            //         },
            //         features: (features || []).map(f => ({ name: f, isIncluded: true })),
            //         description: `Automatic retail plan for ${label}`
            //     });
            // }

            res.status(201).json({ success: true, data: newPlan });
        } catch (error) {
            console.error('Error creating wholesaler plan:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create wholesaler plan',
                error: error.message
            });
        }
    },

    // Sync plans from wholesaler API
    syncPlans: async (req, res) => {
        try {
            const response = await wholesalerService.getRatePlans();
            if (!response.success || !response.data) {
                return res.status(400).json({ success: false, message: 'Failed to fetch plans from wholesaler API' });
            }

            const { dataBankPlans = [], dataPoolPlans = [], mobileRatePlans = [] } = response.data;
            const bulkOps = [];

            // Helper to prepare upsert operations
            const prepareOps = (plans, type) => {
                for (const plan of plans) {
                    bulkOps.push({
                        updateOne: {
                            filter: { value: plan.value },
                            update: {
                                $set: {
                                    label: plan.label,
                                    connection_type_name: plan.connection_type_name,
                                    connection_type: plan.connection_type,
                                    type: type
                                },
                                $setOnInsert: {
                                    custom_name: null,
                                    price: null
                                }
                            },
                            upsert: true
                        }
                    });
                }
            };

            prepareOps(dataBankPlans, 'dataBankPlans');
            prepareOps(dataPoolPlans, 'dataPoolPlans');
            prepareOps(mobileRatePlans, 'mobileRatePlans');

            if (bulkOps.length > 0) {
                await WholesalerPlan.bulkWrite(bulkOps);
            }

            const allPlans = await WholesalerPlan.find().sort({ value: 1 });
            res.status(200).json({ success: true, message: 'Plans synced successfully', data: allPlans });
        } catch (error) {
            console.error('Error syncing wholesaler plans:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to sync wholesaler plans',
                error: error.message
            });
        }
    },

    // Update custom properties (price, custom_name)
    updatePlan: async (req, res) => {
        try {
            const { id } = req.params;
            const { custom_name, price, speed, features, publish } = req.body;

            const updatedPlan = await WholesalerPlan.findByIdAndUpdate(
                id,
                { $set: { custom_name, price, speed, features, isPublish: !!publish } },
                { new: true, runValidators: true }
            );

            if (!updatedPlan) {
                return res.status(404).json({ success: false, message: 'Plan not found' });
            }

            res.status(200).json({ success: true, message: 'Plan updated successfully', data: updatedPlan });
        } catch (error) {
            console.error('Error updating wholesaler plan:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update wholesaler plan',
                error: error.message
            });
        }
    }
};

module.exports = wholesalerPlanController;
