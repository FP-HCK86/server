const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signToken = (payload) => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.jwtSecret);
};

module.exports = {
  signToken,
  verifyToken,
};