require('dotenv').config();
const { connectToDatabase } = require('../config/db');
const Role = require('../models/Role');

// All permission keys from the permission groups
const allPermissionKeys = [
    'user.view',
    'user.invite',
    'user.edit',
    'user.delete',
    'roles.create',
    'plans.view',
    'plans.create',
    'plans.delete',
    'plans.publish',
    'tech.manage',
    'web.edit',
    'seo.manage',
    'analytics.view',
    'testimonials.manage',
    'profiles.view',
    'notes.manage',
    'tickets.manage',
    'services.manage',
    'sim.manage',
    'sys.settings',
    'sys.logs'
];

// Helper to create permissions object with all keys
const allowAll = () => {
    return Object.fromEntries(allPermissionKeys.map(key => [key, true]));
};

// Helper to create permissions object with subset of keys
const allowSubset = (keys) => {
    return Object.fromEntries(allPermissionKeys.map(key => [key, keys.includes(key)]));
};

// Seed roles data
const rolesSeed = [
    {
        name: "Admin",
        description: "Full access to all system features and settings",
        usersCount: 2,
        badge: "Default",
        permissions: allowAll(),
    },
    {
        name: "Content Manager",
        description: "Manage website content, service plans, and SEO settings",
        usersCount: 7,
        badge: "Default",
        permissions: allowSubset([
            "plans.view", "plans.create", "plans.publish",
            "web.edit", "seo.manage", "analytics.view", "testimonials.manage"
        ]),
    },
    {
        name: "Support Agent",
        description: "Handle customer support tickets and manage customer interactions",
        usersCount: 2,
        badge: "Default",
        permissions: allowSubset([
            "profiles.view", "notes.manage", "tickets.manage", "services.manage"
        ]),
    },
    {
        name: "Technician Manager",
        description: "Manage technician network and store locations",
        usersCount: 5,
        badge: "Medium",
        permissions: allowSubset(["tech.manage", "plans.view", "sys.logs"]),
    },
];

async function seedRoles() {
    try {
        // Connect to database
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        await connectToDatabase(mongoUri);
        console.log('Connected to MongoDB');

        // Seed each role (upsert by name to avoid duplicates)
        for (const roleData of rolesSeed) {
            const existingRole = await Role.findOne({ name: roleData.name });
            
            if (existingRole) {
                console.log(`Role "${roleData.name}" already exists, skipping...`);
            } else {
                const role = new Role(roleData);
                await role.save();
                console.log(`✓ Seeded role: ${roleData.name}`);
            }
        }

        console.log('\n✅ Role seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding roles:', error);
        process.exit(1);
    }
}

// Run the seed function
seedRoles();

