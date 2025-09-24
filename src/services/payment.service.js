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
    // Build the payload
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,  // e.g., 50000 (Rp 50k untuk 1 bulan akses)
      },
      customer_details: customerDetails,
      credit_card: { secure: true },
    };

    // Detailed logging for debugging Midtrans failures
    console.info('PaymentService.createTransaction: request', {
      orderId,
      amount,
      customerDetails,
      // Avoid logging secrets like server key here
    });

    try {
      // Call Midtrans
      const transaction = await this.snap.createTransaction(payload);

      // Log full response for debugging (may include token, redirect_url, etc.)
      try {
        console.info('PaymentService.createTransaction: midtrans response', JSON.stringify(transaction));
      } catch (e) {
        console.info('PaymentService.createTransaction: midtrans response (non-serializable)');
      }

      return transaction;
    } catch (err) {
      // Capture as much context as possible without exposing secrets
      const extra = {
        message: err && err.message,
        stack: err && err.stack,
        // If using axios or similar, response data may be in err.response.data
        response: err && err.response && err.response.data ? err.response.data : undefined,
        payload,
      };
      console.error('PaymentService.createTransaction: ERROR calling Midtrans', extra);
      // rethrow so controller can handle and return appropriate HTTP response
      throw err;
    }
  }

  // Method untuk verify payment status (dari webhook Midtrans)
  async verifyPayment(orderId) {
    // Use CoreApi to query transaction status
    const core = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.SERVER_KEY_MIDTRANS,
      clientKey: process.env.CLIENT_KEY_MIDTRANS,
    });

    try {
      const status = await core.transaction.status(orderId);
      return status;
    } catch (err) {
      console.error('[PaymentService] verifyPayment error', err && err.message);
      throw err;
    }
  }
}

module.exports = new PaymentService();