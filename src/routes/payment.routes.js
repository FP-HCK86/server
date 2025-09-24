const express = require('express');
const { createPayment, paymentNotification, checkPaymentStatus } = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/authentication');

const router = express.Router();

router.post('/create', authMiddleware, createPayment);
router.post('/notification', paymentNotification); // webhook (no auth)
router.get('/status', authMiddleware, checkPaymentStatus);

module.exports = router;
