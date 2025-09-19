const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// AUTH ROUTES
router.post('/google-login', authController.googleLogin);

module.exports = router;