const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tier: { type: String, default: 'premium' },
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
