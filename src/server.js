require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./config/db');
const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const stripeRouter = require('./routes/stripe');
const identityRouter = require('./routes/identity');
const supportTicketsRouter = require('./routes/supportTickets');
const packagesRouter = require('./routes/packages');
const paymentMethodsRouter = require('./routes/paymentMethods');
const servicesRouter = require('./routes/services');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/identity', identityRouter);
app.use('/api/support-tickets', supportTicketsRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/services', servicesRouter);

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
