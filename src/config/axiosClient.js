const axios = require('axios');
const api = require('../config/env')

const axiosClient = axios.create({
    baseURL: 'https://getlate.dev/api/v1',
    headers: {
        Authorization: `Bearer ${api.late.apiKey}`,
        'Content-Type': 'application/json',
    },
});

module.exports = axiosClient;

