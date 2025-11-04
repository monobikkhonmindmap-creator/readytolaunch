// routes/payment.js (Complete Corrected Code)

import { Router } from 'express';
import axios from 'axios'; // To call AamarPay API
import { ObjectId } from 'mongodb';
import { authenticateToken } from '../middleware/auth.js';
import {
  AAMARPAY_STORE_ID,
  AAMARPAY_SIGNATURE_KEY,
  AAMARPAY_API_URL,
  SERVER_BASE_URL // Ensure this is your public ngrok URL for testing
} from '../config.js';

const router = Router();

// --- 1. INITIATE PAYMENT ENDPOINT ---
router.post('/payment/initiate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Generate a unique transaction ID
    const tran_id = `${userId}-${Date.now()}`;
    const amount = "10.00"; // Test amount for sandbox

    console.log(`Initiating payment for user ${userId} with tran_id ${tran_id}`);

    // Prepare payload for AamarPay
    const paymentPayload = {
      store_id: AAMARPAY_STORE_ID,
      signature_key: AAMARPAY_SIGNATURE_KEY,
      tran_id: tran_id,
      amount: amount,
      currency: "BDT",
      desc: "Flashcard App - Premium Membership",
      cus_name: userEmail,
      cus_email: userEmail,
      cus_phone: "01xxxxxxxxx", // Placeholder
      success_url: `${SERVER_BASE_URL}/payment/success`,
      fail_url: `${SERVER_BASE_URL}/payment/fail`,
      cancel_url: `${SERVER_BASE_URL}/payment/cancel`,
      type: "json", // Request JSON response from AamarPay if possible for payment URL step
      opt_a: userId.toString(), // Pass userId
    };

    // --- Make POST request to AamarPay ---
    console.log("Sending request to AamarPay (as x-www-form-urlencoded):", paymentPayload);

    // --- THIS IS THE FIX ---
    // Manually format the payload object into a URL-encoded string
    const formData = new URLSearchParams();
    for (const key in paymentPayload) {
      // Ensure values are strings, especially if numbers or booleans are possible
      formData.append(key, String(paymentPayload[key]));
    }
    // --- END FIX ---

    // Send the formatted data as a string and set the correct header
    const aamarPayResponse = await axios.post(AAMARPAY_API_URL, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log("Received response from AamarPay:", aamarPayResponse.data);

    // --- Process AamarPay Response ---
    // AamarPay JSON response for initiation often includes a 'result' and 'payment_url'
    // Check for potential string values 'true'/'false' or boolean true/false
    const isSuccess = String(aamarPayResponse.data.result).toLowerCase() === 'true';

    if (isSuccess && aamarPayResponse.data.payment_url) {
        // Send the payment URL back to the app
        res.status(200).json({ paymentUrl: aamarPayResponse.data.payment_url });
    } else {
      // Payment initiation failed at AamarPay or URL missing
      console.error("AamarPay payment initiation failed or missing URL:", aamarPayResponse.data);
      res.status(400).json({
          message: aamarPayResponse.data.message || aamarPayResponse.data.desc || "Could not initiate payment with AamarPay."
      });
    }

  } catch (error) {
    // Log detailed error information
    console.error("Error in /payment/initiate:");
    if (error.response) {
        // Error response from AamarPay
        console.error("AamarPay Response Data:", error.response.data);
        console.error("AamarPay Response Status:", error.response.status);
    } else if (error.request) {
        // Network error - request made but no response
        console.error("AamarPay Request Error:", error.request);
    } else {
        // Setup error
        console.error("Error Message:", error.message);
    }
    res.status(500).json({ message: "Server error during payment initiation." });
  }
});


// --- 2. PAYMENT SUCCESS CALLBACK ENDPOINT ---
router.post('/payment/success', async (req, res) => {
  console.log("Received AamarPay Success Callback/IPN:", req.body);
  const {
      mer_txnid,      // Your original transaction ID
      pay_status,
      amount_original,
      currency,
      opt_a,          // Your user ID
      // You might receive signature_key here for validation (optional but recommended)
      // verify_sign, pg_txnid, bank_txn, card_type etc.
  } = req.body;

  // --- Basic Validation ---
  if (!mer_txnid || !opt_a || pay_status !== 'Successful') {
    console.error("Invalid success callback data:", req.body);
     return res.status(400).send(`<html><body><h1>Payment Failed</h1><p>Invalid payment confirmation data.</p><p><a href="flashcardapp://payment/failure">Close</a></p></body></html>`);
  }

  // --- Amount Validation ---
  const expectedAmount = "10.00"; // Should match initiated amount
  if (amount_original !== expectedAmount || currency !== "BDT") {
      console.error(`Amount mismatch! Expected ${expectedAmount} BDT, Received ${amount_original} ${currency}. TXN: ${mer_txnid}`);
       return res.status(400).send(`<html><body><h1>Payment Failed</h1><p>Payment amount mismatch.</p><p><a href="flashcardapp://payment/failure">Close</a></p></body></html>`);
  }

  // --- Signature Validation (Optional but Recommended) ---
  // Re-generate the signature based on received data + your signature key
  // Compare it with verify_sign if received. If they don't match, reject.
  // const calculatedSignature = generateSignature(req.body, AAMARPAY_SIGNATURE_KEY);
  // if (calculatedSignature !== verify_sign) { ... return res.status(400).send(...) }

  try {
    const userId = new ObjectId(opt_a);

    // --- Idempotency Check ---
    const user = await global.db.collection('users').findOne({ _id: userId });

    // Check if user exists before trying to update
    if (!user) {
        console.error(`User not found for ID ${opt_a} during success callback. TXN: ${mer_txnid}`);
        // Consider how to handle this - maybe log transaction for manual check
         return res.status(404).send(`<html><body><h1>Error</h1><p>User account not found.</p><p><a href="flashcardapp://payment/error">Close</a></p></body></html>`);
    }

    if (user.status === 'premium') {
        console.log(`User ${userId} is already premium. Ignoring success callback for ${mer_txnid}.`);
         return res.status(200).send(`<html><body><h1>Payment Successful!</h1><p>Your account is already premium.</p><p><a href="flashcardapp://payment/success">Close</a></p></body></html>`);
    }
     // More robust check: Check if `paymentHistory` already contains `mer_txnid`

    // --- Update User Status ---
    console.log(`Updating user ${userId} to premium for transaction ${mer_txnid}`);
    const updateResult = await global.db.collection('users').updateOne(
      { _id: userId },
      {
          $set: { status: 'premium' },
          $push: { paymentHistory: { tranId: mer_txnid, amount: amount_original, date: new Date(), status: 'Successful' } }
      }
    );

    if (updateResult.modifiedCount === 1) {
        console.log(`User ${userId} updated to premium.`);
        // --- Respond/Redirect for User ---
        res.status(200).send(`<html><body><h1>Payment Successful!</h1><p>Your premium membership is now active.</p><p><a href="flashcardapp://payment/success">Tap here to return to the app</a></p></body></html>`);
    } else {
         console.error(`Failed to update user status for ${userId} despite successful payment ${mer_txnid}.`);
          // This case indicates a potential database issue or logic error
         throw new Error("Failed to update user status in database.");
    }

  } catch (error) {
    console.error("Error processing success callback:", error);
     res.status(500).send(`<html><body><h1>Error</h1><p>There was an error updating your account. Please contact support.</p><p>Transaction ID: ${mer_txnid || 'N/A'}</p><p><a href="flashcardapp://payment/error">Close</a></p></body></html>`);
  }
});


// --- 3. PAYMENT FAIL CALLBACK ENDPOINT ---
router.post('/payment/fail', (req, res) => {
  console.log("Received AamarPay Fail Callback:", req.body);
   res.status(400).send(`<html><body><h1>Payment Failed</h1><p>Your payment could not be processed.</p><p>Reason: ${req.body.status_details || req.body.error_msg || 'Unknown error'}</p><p><a href="flashcardapp://payment/failure">Tap here to return to the app</a></p></body></html>`);
});


// --- 4. PAYMENT CANCEL CALLBACK ENDPOINT ---
router.post('/payment/cancel', (req, res) => {
  console.log("Received AamarPay Cancel Callback:", req.body);
  res.status(200).send(`<html><body><h1>Payment Cancelled</h1><p>Your payment process was cancelled.</p><p><a href="flashcardapp://payment/cancel">Tap here to return to the app</a></p></body></html>`);
});

export default router;