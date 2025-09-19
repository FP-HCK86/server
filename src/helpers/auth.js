const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const hashPassword = (password) => {
  return bcrypt.hashSync(password, 10);
};

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });
};

module.exports = { hashPassword, generateToken };
