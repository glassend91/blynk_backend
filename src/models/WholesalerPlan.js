const mongoose = require('mongoose');

const wholesalerPlanSchema = new mongoose.Schema({
    value: {
        type: Number,
        required: false, // Optional for NBN
        unique: false    // Cannot be unique if null exists for multiple NBN plans
    },
    bandwidth_id: {
        type: String,
        required: false, // Required for NBN
        unique: false
    },
    label: {
        type: String,
        required: true
    },
    speed: {
        type: String,
        required: false // For NBN
    },
    connection_type_name: {
        type: String,
        required: false
    },
    connection_type: {
        type: Number,
        required: false
    },
    type: {
        type: String,
        enum: ['dataBankPlans', 'dataPoolPlans', 'mobileRatePlans', 'nbn'],
        required: true
    },
    custom_name: {
        type: String,
        default: null
    },
    price: {
        type: Number,
        default: null
    },
    features: {
        type: [String],
        default: []
    },
    isPublish: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('WholesalerPlan', wholesalerPlanSchema);
