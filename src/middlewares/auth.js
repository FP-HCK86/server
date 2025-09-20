const jwt = require('jsonwebtoken');
const env = require('../config/env');

const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];  // Bearer <token>
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, env.jwt.secret);
        req.user = decoded;  // { id, email }
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = auth;