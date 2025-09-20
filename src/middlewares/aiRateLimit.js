/**
 * Simple in-memory rate limiting middleware for AI endpoints
 */
const rateLimitMap = new Map();

const aiRateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 10, // 10 requests per minute
    message = 'Too many AI requests, please try again later'
  } = options;

  return (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean old entries
    const cutoff = now - windowMs;
    for (const [key, data] of rateLimitMap.entries()) {
      if (data.lastReset < cutoff) {
        rateLimitMap.delete(key);
      }
    }

    // Get or create client data
    let clientData = rateLimitMap.get(clientId);
    if (!clientData || clientData.lastReset < cutoff) {
      clientData = {
        count: 0,
        lastReset: now
      };
    }

    // Check if limit exceeded
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: message,
        retryAfter: Math.ceil((clientData.lastReset + windowMs - now) / 1000)
      });
    }

    // Increment counter
    clientData.count++;
    rateLimitMap.set(clientId, clientData);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.count),
      'X-RateLimit-Reset': new Date(clientData.lastReset + windowMs).toISOString()
    });

    next();
  };
};

module.exports = { aiRateLimit };
