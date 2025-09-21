const express = require('express');
const { createPayment, paymentNotification } = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/authentication');

const router = express.Router();

router.post('/create', authMiddleware, createPayment);
router.post('/notification', paymentNotification);  // Webhook (tidak perlu auth)

module.exports = router;