const jwt = require("jsonwebtoken");
const env = require("../config/env");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  console.log('[AUTH DEBUG] Headers:', req.headers['authorization']);
  console.log('[AUTH DEBUG] Token extracted:', token ? 'Found' : 'Not found');

  if (!token) {
    console.log('[AUTH DEBUG] No token provided');
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, env.jwtSecret, (err, user) => {
    if (err) {
      console.log('[AUTH DEBUG] JWT verification failed:', err.message);
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    console.log('[AUTH DEBUG] JWT verification successful:', { id: user.id, email: user.email });
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
