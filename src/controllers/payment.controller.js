const PaymentService = require("../services/payment.service");
const User = require("../models/User");
const PaymentTransaction = require("../models/PaymentTransaction");
const crypto = require("crypto");

exports.createPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // safer read body and log for debugging
    const body = req.body || {};
    console.info("createPayment called", {
      userId: req.user && req.user.id,
      body,
    });

    // Revert to allowing a default tier when the client doesn't send one.
    // This undoes the strict 'tier required' validation that caused 400 when client didn't include tier.
    const { tier = "premium", amount: bodyAmount } = body;

    // optional: still validate allowed values but fallback to 'premium' if invalid
    const allowed = ["premium", "basic"];
    const resolvedTier = allowed.includes(tier) ? tier : "premium";

    // compute amount by tier (optional client override via body.amount)
    const amount = bodyAmount || (resolvedTier === "premium" ? 50000 : 100000);

    const short = crypto.randomBytes(4).toString("hex");
    const orderId = `up_${Date.now().toString().slice(-6)}_${short}`;

    // persist transaction mapping
    await PaymentTransaction.create({
      orderId,
      user: user._id,
      tier: resolvedTier,
      amount,
      status: "pending",
    });

    const customerDetails = {
      first_name: user.username || "User",
      email: user.email,
    };

    const transaction = await PaymentService.createTransaction(
      orderId,
      amount,
      customerDetails
    );
    return res.json({
      token: transaction.token,
      order_id: orderId,
      redirect_url: transaction.redirect_url,
    });
  } catch (error) {
    console.error(
      "createPayment error",
      error && error.message,
      error && error.stack
    );
    return res.status(500).json({ error: "Failed to create payment" });
  }
};

exports.paymentNotification = async (req, res) => {
  try {
    const body = req.body || {};
    const { order_id, transaction_status } = body;

    if (!order_id) return res.status(200).send("OK");

    // Verify Midtrans signature_key
    // accept common field names for signature sent by Midtrans
    const receivedSig =
      body.signature_key || body.signature || body.signatureKey || "";
    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    if (!receivedSig) {
      console.warn("paymentNotification: missing signature_key", { order_id });
      return res.status(400).send("Missing signature_key");
    }
    if (!serverKey) {
      console.error("paymentNotification: MIDTRANS_SERVER_KEY not configured");
      return res.status(500).send("Server misconfiguration");
    }

    // Build the exact string Midtrans expects: order_id + status_code + gross_amount + serverKey
    const status_code =
      body.status_code !== undefined && body.status_code !== null
        ? String(body.status_code)
        : "";
    const gross_amount =
      body.gross_amount !== undefined && body.gross_amount !== null
        ? String(body.gross_amount)
        : "";
    const sigSource = `${order_id}${status_code}${gross_amount}${serverKey}`;

    const expectedBuf = Buffer.from(
      crypto.createHash("sha512").update(sigSource).digest("hex"),
      "utf8"
    );
    const receivedBuf = Buffer.from(String(receivedSig), "utf8");

    // timingSafeEqual requires equal length; fail fast if lengths differ
    let sigValid = false;
    if (expectedBuf.length === receivedBuf.length) {
      try {
        sigValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
      } catch (e) {
        sigValid = false;
      }
    }

    if (!sigValid) {
      console.warn("paymentNotification: invalid signature_key", {
        order_id,
        expected: expectedBuf.toString(),
        received: receivedBuf.toString(),
      });
      return res.status(403).send("Invalid signature");
    }

    const tx = await PaymentTransaction.findOne({ orderId: order_id });
    if (!tx) {
      console.warn("Unknown order_id in notification", order_id);
      return res.status(200).send("OK");
    }

    tx.status = transaction_status || tx.status;
    tx.meta = { ...tx.meta, raw: body };
    await tx.save();

    if (
      transaction_status === "settlement" ||
      transaction_status === "capture"
    ) {
      try {
        const update = {
          subscription: tx.tier,
          subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          scheduleCount: 0,
          isPremium: true,
        };
        await User.findByIdAndUpdate(tx.user, update);
      } catch (err) {
        console.error("Failed to upgrade user after settlement", err);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("paymentNotification error", err && err.message);
    return res.status(500).send("ERROR");
  }
};

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) return res.status(400).json({ error: "order_id required" });

    const tx = await PaymentTransaction.findOne({ orderId: order_id });
    if (!tx) return res.status(404).json({ error: "transaction not found" });

    const status = await PaymentService.verifyPayment(order_id).catch(
      (e) => null
    );
    if (status && status.transaction_status) {
      tx.status = status.transaction_status;
      tx.meta = { ...tx.meta, lastStatus: status };
      await tx.save();

      if (
        status.transaction_status === "settlement" ||
        status.transaction_status === "capture"
      ) {
        await User.findByIdAndUpdate(tx.user, {
          subscription: tx.tier,
          subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          scheduleCount: 0,
          isPremium: true,
        });
      }
    }

    return res.json({ tx, status });
  } catch (err) {
    console.error("checkPaymentStatus error", err && err.message);
    return res.status(500).json({ error: "Failed to check payment status" });
  }
};
