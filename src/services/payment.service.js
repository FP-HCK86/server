const midtransClient = require('midtrans-client');

class PaymentService {
  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.SERVER_KEY_MIDTRANS,
      clientKey: process.env.CLIENT_KEY_MIDTRANS,
    });
  }

  async createTransaction(orderId, amount, customerDetails) {
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,  // e.g., 50000 (Rp 50k untuk 1 bulan akses)
      },
      customer_details: customerDetails,
      credit_card: { secure: true },
    };
    return await this.snap.createTransaction(parameter);
  }

  // Method untuk verify payment status (dari webhook Midtrans)
  async verifyPayment(orderId) {
    // Panggil Midtrans API untuk check status
    // Implementasi lengkap di docs Midtrans
  }
}

module.exports = new PaymentService();