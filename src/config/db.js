const mongoose = require('mongoose');

async function connectToDatabase(mongoUri) {
    if (!mongoUri) {
        throw new Error('MONGO_URI is not defined');
    }

    mongoose.set('strictQuery', true);

    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    return mongoose.connection;
}

module.exports = { connectToDatabase };
