// routes/connect.js
const express = require('express');
const { startConnect, connectCallback, getConnectionStatus, syncAccounts } = require('../controllers/connectSocialLate.controller');
const authentication = require('../middlewares/authentication');

const router = express.Router();

// Add middleware to log all requests to this router
router.use((req, res, next) => {
  console.log('Connect route accessed:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    params: req.params,
    headers: req.headers
  });
  next();
});

// FE klik tombol → pukul endpoint ini untuk redirect ke OAuth
// GET /connect/:platform?profileId=...&userId=...
router.get('/:platform', authentication, startConnect);

// Defensive: explicitly block accidental '/connect/undefined' calls early
router.get('/undefined', (req, res) => {
  console.warn('Blocked request to /connect/undefined – likely FE bug or missing variable substitution', {
    originalUrl: req.originalUrl,
    query: req.query,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
    }
  });
  return res.status(400).json({ error: 'Platform undefined – front-end did not supply a valid platform name' });
});

// Callback setelah OAuth (redirect_url)
router.get('/callback/:platform', connectCallback);

// FE bisa cek status akun user
// GET /connect/status?userId=...&profileId=...
router.get('/status', authentication, getConnectionStatus);

// Manual sync accounts (after schema upgrade)
router.post('/sync', authentication, syncAccounts);

module.exports = router;
