const express = require('express');
const { checkConnections } = require('../controllers/accountLate.controller');
const router = express.Router();

// GET /accounts/check?profileId=xxxx
router.get('/check', checkConnections);

module.exports = router;
