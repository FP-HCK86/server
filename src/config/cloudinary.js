// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const env = require('./env');

cloudinary.config({
    cloud_name: env.cloudinary.cloudName,   // on .env
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
});

module.exports = cloudinary;
