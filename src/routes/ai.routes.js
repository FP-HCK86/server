const express = require('express');
const router = express.Router();
const { 
  generateContentController, 
  chatController, 
  healthCheckController 
} = require('../controllers/ai.controller');
const { aiRateLimit } = require('../middlewares/aiRateLimit');

// Middleware for request logging (optional)
const requestLogger = (req, res, next) => {
  console.log(`[AI API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
};

// Apply logging middleware
router.use(requestLogger);

// Apply rate limiting to AI endpoints (except health check)
const aiRateLimitMiddleware = aiRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Too many AI requests. Please wait a moment before trying again.'
});

// Health check endpoint (no rate limit)
router.get('/health', healthCheckController);

// Generate content from prompt (Mode 1: Create content from scratch)
router.post('/generate-content', aiRateLimitMiddleware, generateContentController);

// Chat with AI for brainstorming and refinement
router.post('/chat', aiRateLimitMiddleware, chatController);

module.exports = router;
