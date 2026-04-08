require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('../config/db');
const Service = require('../models/Service');
const User = require('../models/User');

async function seedServices() {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) throw new Error('MONGO_URI is not defined');

        await connectToDatabase(mongoUri);
        console.log('Connected to MongoDB');

        // Try to find an existing admin/provider user
        let provider = await User.findOne({ role: { $in: ['superAdmin', 'admin'] } });

        if (!provider) {
            // If none exists, try to find any user to attach as provider
            provider = await User.findOne({});
        }

        if (!provider) {
            // Create a seed provider user so providerId is always present (required by Service schema)
            const seedEmail = process.env.SEED_PROVIDER_EMAIL || 'seed-provider@local';
            const seedPassword = process.env.SEED_PROVIDER_PASSWORD || 'SeedProvider123!';
            const passwordHash = await bcrypt.hash(seedPassword, 10);
            provider = await User.create({
                firstName: 'Seed',
                lastName: 'Provider',
                email: seedEmail,
                passwordHash,
                role: 'admin',
                status: 'Active'
            });
            console.log('Created seed provider user:', provider.email);
        }

        const providerId = provider._id;

        const services = [
            // NBN plans (3)
            {
                serviceName: 'NBN Basic 25/5',
                serviceType: 'NBN',
                specifications: { downloadSpeed: 25, uploadSpeed: 5, dataAllowance: 'Unlimited' },
                price: 59.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Entry-level NBN plan',
                providerId,
                features: [{ name: 'Unlimited data', description: '' }]
            },
            {
                serviceName: 'NBN Standard 100/20',
                serviceType: 'NBN',
                specifications: { downloadSpeed: 100, uploadSpeed: 20, dataAllowance: 'Unlimited' },
                price: 69.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Standard NBN plan with 100/20 speeds',
                providerId,
                features: [{ name: 'Unlimited data', description: 'No data caps' }]
            },
            {
                serviceName: 'NBN Premium 250/100',
                serviceType: 'NBN',
                specifications: { downloadSpeed: 250, uploadSpeed: 100, dataAllowance: 'Unlimited' },
                price: 129.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Premium NBN plan for heavy users',
                providerId,
                features: [{ name: 'Priority support', description: '' }]
            },

            // Mobile plans (3)
            {
                serviceName: 'Mobile Lite 5GB',
                serviceType: 'Mobile',
                specifications: { voiceMinutes: '250', smsMessages: '500', dataAllowance: '5GB' },
                price: 19.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Affordable mobile plan with 5GB data',
                providerId,
                features: [{ name: '5GB data', description: '' }]
            },
            {
                serviceName: 'Mobile Standard 30GB',
                serviceType: 'Mobile',
                specifications: { voiceMinutes: 'Unlimited', smsMessages: 'Unlimited', dataAllowance: '30GB' },
                price: 35.00,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Popular mobile plan with 30GB',
                providerId,
                features: [{ name: '30GB data', description: '' }]
            },
            {
                serviceName: 'Mobile Unlimited',
                serviceType: 'Mobile',
                specifications: { voiceMinutes: 'Unlimited', smsMessages: 'Unlimited', dataAllowance: 'Unlimited' },
                price: 59.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Unlimited calls and data (fair use applies)',
                providerId,
                features: [{ name: 'Unlimited data', description: 'Fair use policy applies' }]
            },

            // Mobile Broadband / Data Only plans (3)
            {
                serviceName: 'MBB 50GB',
                serviceType: 'Data Only',
                specifications: { dataAllowance: '50GB' },
                price: 29.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Mobile broadband 50GB data-only plan',
                providerId,
                features: [{ name: '50GB data', description: '' }]
            },
            {
                serviceName: 'MBB 100GB',
                serviceType: 'Data Only',
                specifications: { dataAllowance: '100GB' },
                price: 45.00,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'Mobile broadband 100GB data-only plan',
                providerId,
                features: [{ name: '100GB data', description: '' }]
            },
            {
                serviceName: 'MBB Unlimited 300GB',
                serviceType: 'Data Only',
                specifications: { dataAllowance: '300GB' },
                price: 89.99,
                currency: 'AUD',
                billingCycle: 'monthly',
                description: 'High-usage mobile broadband plan',
                providerId,
                features: [{ name: '300GB data', description: '' }]
            }
        ];

        for (const svc of services) {
            const query = { serviceName: svc.serviceName, serviceType: svc.serviceType };
            await Service.findOneAndUpdate(query, svc, { upsert: true, new: true, setDefaultsOnInsert: true });
            console.log(`Upserted service: ${svc.serviceName}`);
        }

        console.log('✅ Service seeding complete');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding services:', err);
        process.exit(1);
    }
}

seedServices();
