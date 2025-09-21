const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authentication = require('../middlewares/authentication');

router.get('/profile', authentication, userController.getUserProfile);

module.exports = router;