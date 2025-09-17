require('dotenv').config();

const requiredKeys = ['PORT', 'MONGODB_URI', 'JWT_SECRET'];
requiredKeys.forEach((k) => {
    if (!process.env[k]) {
        console.warn(`[env] Missing ${k} in .env`);
    }
});

const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,

    openaiApiKey: process.env.OPENAI_API_KEY,
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
    },
    late: {
        apiKey: process.env.LATE_API_KEY,
        webhookSecret: process.env.LATE_WEBHOOK_SECRET,
    },
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
};

module.exports = env;
