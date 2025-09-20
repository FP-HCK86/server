// routes/connect.js
const express = require('express');
const { startConnect, connectCallback, getConnectionStatus } = require('../controllers/connectSocialLate.controller');

const router = express.Router();

// FE klik tombol → pukul endpoint ini untuk redirect ke OAuth
// GET /connect/:platform?profileId=...&userId=...
router.get('/:platform', startConnect);

// Callback setelah OAuth (redirect_url)
router.get('/callback', connectCallback);

// FE bisa cek status akun user
// GET /connect/status?userId=...&profileId=...
router.get('/status', getConnectionStatus);

module.exports = router;
