const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authentication = require('../middlewares/authentication');

// AUTH ROUTES
router.post('/google-login', authController.googleLogin);
router.post('/register', authController.register);
router.post('/login', authController.login);

// PROTECTED ROUTE EXAMPLE
router.get('/dashboard', authentication, (req, res) => {
  res.json({ user: req.user });
});


module.exports = router;