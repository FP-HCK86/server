const PaymentService = require('../services/payment.service');
const User = require('../models/User');  // Asumsi ada model User

exports.createPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);  // Query user lengkap
    if (!user) return res.status(404).json({ error: 'User not found' });

    const amount = req.body.amount || 50000;
    const orderId = `order-${user._id}-${Date.now()}`;

    const customerDetails = {
      first_name: user.username || 'User',  // Gunakan username dari DB
      email: user.email,
    };
    const transaction = await PaymentService.createTransaction(orderId, amount, customerDetails);
    res.json({ token: transaction.token, order_id:orderId, redirect_url: transaction.redirect_url });
  } catch (error) {
    console.error('Payment creation error:', error.message);  // Log detail error
    res.status(500).json({ error: 'Failed to create payment' });
  }
};
// Webhook dari Midtrans (untuk update status setelah bayar)
exports.paymentNotification = async (req, res) => {
  const { order_id, transaction_status } = req.body;
  if (transaction_status === 'settlement') {
    // Update user: set premium=true atau reset post counter
    const userId = order_id.split('-')[1];  // Extract dari orderId
    await User.findByIdAndUpdate(userId, { isPremium: true });  // Tambah field isPremium di model User
  }
  res.status(200).send('OK');
};