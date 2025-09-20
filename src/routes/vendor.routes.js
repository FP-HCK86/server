const express = require('express');
const { schedulePost } = require('../controllers/vendor.controller');
const router = express.Router();

router.post('/schedule', schedulePost);

module.exports = router;
