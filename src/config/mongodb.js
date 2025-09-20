const { MongoClient, ServerApiVersion } = require("mongodb");
const mongoose = require('mongoose');
const env = require('./env');

const uri = env.mongodbUri;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const connectDB = async () => {
    try {
        await mongoose.connect(env.mongodbUri, {
            dbName: 'test'
        });
        console.log('MongoDB connected successfully');
        console.log('Connected to database:', mongoose.connection.db.databaseName);
        console.log('MongoDB URI:', env.mongodbUri);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // process.exit(1);
    }
};

module.exports = {
    connectDB
}
