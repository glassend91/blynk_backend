require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('../config/db');
const User = require('../models/User');

async function seedSuperAdmin() {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }

        await connectToDatabase(mongoUri);
        console.log('Connected to MongoDB');

        const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@blynk.com';
        const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

        let user = await User.findOne({ email: email.toLowerCase() });

        if (user) {
            console.log(`Super admin user with email "${email}" already exists. Skipping creation.`);
            process.exit(0);
        }

        const passwordHash = await bcrypt.hash(password, 10);

        user = await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: email.toLowerCase(),
            passwordHash,
            role: 'superAdmin',
            subrole: 'Super Admin',
            adminRoleLabel: 'Super Admin',
            status: 'Active',
        });

        console.log('✅ Super admin user created successfully!');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding super admin:', error);
        process.exit(1);
    }
}

seedSuperAdmin();


