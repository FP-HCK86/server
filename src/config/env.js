require('dotenv').config();

const requiredKeys = ['PORT', 'MONGODB_URI', 'JWT_SECRET'];
const optionalKeys = ['LATE_API_KEY', 'LATE_BASE_URL'];

requiredKeys.forEach((k) => {
    if (!process.env[k]) {
        console.warn(`[env] Missing required ${k} in .env`);
    }
});

optionalKeys.forEach((k) => {
    if (!process.env[k]) {
        console.info(`[env] Optional ${k} not set in .env`);
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
        baseUrl: process.env.LATE_BASE_URL || 'https://getlate.dev/api/v1',
        webhookSecret: process.env.LATE_WEBHOOK_SECRET,
        tiktokCallbackUrl: process.env.TIKTOK_CALLBACK_URL,
        instagramCallbackUrl: process.env.INSTAGRAM_CALLBACK_URL,
    },
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    clientBaseUrl: process.env.CLIENT_BASE_URL || process.env.VITE_CLIENT_BASE_URL || 'http://localhost:5173',
};

module.exports = env;
