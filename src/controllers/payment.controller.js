const PaymentService = require('../services/payment.service');
const User = require('../models/User');
const PaymentTransaction = require('../models/PaymentTransaction');
const crypto = require('crypto');

exports.createPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

  // safely read body (req.body might be undefined if client sent no JSON)
  const { tier = 'premium', amount: bodyAmount } = req.body || {};
  const amount = bodyAmount || (tier === 'premium' ? 50000 : 100000);

    const short = crypto.randomBytes(4).toString('hex');
    const orderId = `up_${Date.now().toString().slice(-6)}_${short}`;

    // persist transaction mapping
    await PaymentTransaction.create({ orderId, user: user._id, tier, amount, status: 'pending' });

    const customerDetails = {
      first_name: user.username || 'User',
      email: user.email,
    };

    const transaction = await PaymentService.createTransaction(orderId, amount, customerDetails);
    return res.json({ token: transaction.token, order_id: orderId, redirect_url: transaction.redirect_url });
  } catch (error) {
    console.error('createPayment error', error && error.message);
    return res.status(500).json({ error: 'Failed to create payment' });
  }
};

exports.paymentNotification = async (req, res) => {
  try {
    const { order_id, transaction_status } = req.body || {};
    if (!order_id) return res.status(200).send('OK');

    const tx = await PaymentTransaction.findOne({ orderId: order_id });
    if (!tx) {
      console.warn('Unknown order_id in notification', order_id);
      return res.status(200).send('OK');
    }

    tx.status = transaction_status || tx.status;
    tx.meta = { ...tx.meta, raw: req.body };
    await tx.save();

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      try {
        const update = { subscription: tx.tier, subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), scheduleCount: 0 };
        await User.findByIdAndUpdate(tx.user, update);
      } catch (err) {
        console.error('Failed to upgrade user after settlement', err);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('paymentNotification error', err && err.message);
    return res.status(500).send('ERROR');
  }
};

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });

    const tx = await PaymentTransaction.findOne({ orderId: order_id });
    if (!tx) return res.status(404).json({ error: 'transaction not found' });

    const status = await PaymentService.verifyPayment(order_id).catch((e) => null);
    if (status && status.transaction_status) {
      tx.status = status.transaction_status;
      tx.meta = { ...tx.meta, lastStatus: status };
      await tx.save();

      if (status.transaction_status === 'settlement' || status.transaction_status === 'capture') {
        await User.findByIdAndUpdate(tx.user, { subscription: tx.tier, subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), scheduleCount: 0 });
      }
    }

    return res.json({ tx, status });
  } catch (err) {
    console.error('checkPaymentStatus error', err && err.message);
    return res.status(500).json({ error: 'Failed to check payment status' });
  }
};
