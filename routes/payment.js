// routes/payment.js
import { Router } from 'express';
import axios from 'axios';
import { ObjectId } from 'mongodb';
import { authenticateToken } from '../middleware/auth.js';
import { 
  AAMARPAY_STORE_ID, 
  AAMARPAY_SIGNATURE_KEY, 
  AAMARPAY_API_URL, 
  SERVER_BASE_URL 
} from '../config.js';

const router = Router();

// --- INITIATE PAYMENT ENDPOINT ---
router.post('/initiate-payment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const tran_id = `${userId}_${Date.now()}`;

    const paymentData = {
      store_id: AAMARPAY_STORE_ID,
      signature_key: AAMARPAY_SIGNATURE_KEY,
      tran_id: tran_id,
      amount: "10.00", // Test amount
      currency: "BDT",
      desc: "Premium Membership",
      cus_name: userEmail,
      cus_email: userEmail,
      cus_phone: "01700000000",
      cus_add1: "Dhaka",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      type: "json",
      success_url: `${SERVER_BASE_URL}/payment/success`,
      fail_url: `${SERVER_BASE_URL}/payment/fail`,
      ipn_url: `${SERVER_BASE_URL}/payment/ipn`,
    };

    const response = await axios.post(AAMARPAY_API_URL, paymentData);

    if (response.data.result === "true" && response.data.payment_url) {
      res.status(200).json({ payment_url: response.data.payment_url });
    } else {
      console.error("Aamarpay init error:", response.data);
      res.status(400).json({ message: "Payment gateway error.", error: response.data });
    }
  } catch (error) {
    console.error("Error in /initiate-payment:", error);
    res.status(500).json({ message: "Server error." });
  }
});

// --- PAYMENT IPN (CALLBACK) ENDPOINT ---
router.post('/payment/ipn', async (req, res) => {
  try {
    const ipnData = req.body;
    console.log("Received IPN:", ipnData);

    if (ipnData.signature_key !== AAMARPAY_SIGNATURE_KEY) {
      console.error("Invalid IPN signature");
      return res.status(400).send("Invalid signature");
    }

    if (ipnData.pay_status === "Successful") {
      const tran_id = ipnData.tran_id;
      const userId = tran_id.split('_')[0];

      if (!userId) {
        console.error("Could not parse userId from tran_id:", tran_id);
        return res.status(400).send("Invalid transaction ID");
      }

      console.log(`Updating user ${userId} to premium...`);
      await global.db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { status: "premium" } }
      );
      console.log(`User ${userId} is now premium!`);
    } else {
      console.log(`Payment failed for tran_id: ${ipnData.tran_id}`);
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error in /payment/ipn:", error);
    res.status(500).send("Server error");
  }
});

// --- Payment Success/Fail Redirects ---
router.post('/payment/success', (req, res) => {
  res.send("Payment successful! You can close this window.");
});

router.post('/payment/fail', (req, res) => {
  res.send("Payment failed. You can close this window.");
});

export default router;