require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./src/config/db');
const healthRouter = require('./src/routes/health');
const authRouter = require('./src/routes/auth');
const stripeRouter = require('./src/routes/stripe');
const identityRouter = require('./src/routes/identity');
const supportTicketsRouter = require('./src/routes/supportTickets');
const packagesRouter = require('./src/routes/packages');
const paymentMethodsRouter = require('./src/routes/paymentMethods');
const servicesRouter = require('./src/routes/services');
const billingRouter = require('./src/routes/billing');
const mobileRouter = require('./src/routes/mobile');
const websiteContentRouter = require('./src/routes/websiteContent');
const testimonialsRouter = require('./src/routes/testimonials');
const storesRouter = require('./src/routes/stores');
const simOrdersRouter = require('./src/routes/simOrders');
const customerVerificationRouter = require('./src/routes/customerVerification');
const customerPlansRouter = require('./src/routes/customerPlans');
const customerRouter = require('./src/routes/customer');
const systemSettingsRouter = require('./src/routes/systemSettings');
const dashboardRouter = require('./src/routes/dashboard');
const rolesRouter = require('./src/routes/roles');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/stores', storesRouter);
app.use('/api/billing', billingRouter);
app.use('/api/v1/mobile', mobileRouter);
app.use('/api/identity', identityRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/services', servicesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/sim-orders', simOrdersRouter);
app.use('/api/v1/customer', customerRouter);
app.use('/api/testimonials', testimonialsRouter);
app.use('/api/customer-plans', customerPlansRouter);
app.use('/api/system-settings', systemSettingsRouter);
app.use('/api/support-tickets', supportTicketsRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/website-content', websiteContentRouter);
app.use('/api/customer-verification', customerVerificationRouter);

// 404 and Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const port = process.env.PORT || 3000;

async function startServer() {
    try {
        console.log(' MONGO_URI set:', process.env.MONGO_URI);
        if (process.env.MONGO_URI) {
            await connectToDatabase(process.env.MONGO_URI);
            console.log('Connected to MongoDB');
        } else {
            console.warn('MONGO_URI is not set. Starting server without DB connection.');
        }
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
