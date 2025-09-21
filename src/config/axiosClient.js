const axios = require('axios');
const env = require('./env');

// Create a pre-configured Axios instance for Late API calls. The instance
// sets the base URL from our Late config and automatically attaches the
// Authorization header containing your Late API key. This avoids having
// to specify the base URL and headers on every request.

console.log('Late API Configuration:', {
  baseURL: env.late.baseUrl,
  hasApiKey: !!env.late.apiKey,
  apiKeyStart: env.late.apiKey ? env.late.apiKey.substring(0, 10) + '...' : 'missing'
});

const axiosClient = axios.create({
  baseURL: env.late.baseUrl,
  headers: {
    'Authorization': `Bearer ${env.late.apiKey || ''}`,
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
axiosClient.interceptors.request.use(
  (config) => {
    console.log('Late API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      hasAuth: !!config.headers.Authorization
    });
    return config;
  },
  (error) => {
    console.error('Late API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
axiosClient.interceptors.response.use(
  (response) => {
    console.log('Late API Response:', {
      status: response.status,
      url: response.config.url,
      hasData: !!response.data
    });
    return response;
  },
  (error) => {
    console.error('Late API Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

module.exports = axiosClient;