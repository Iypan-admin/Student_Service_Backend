// routes/webhookpaymentRoutes.js
const express = require("express");
const router = express.Router();
const { razorpayWebhook } = require("../controllers/paymentWebhookController");

// ✅ Use express.raw({ type: "*/*" }) for Razorpay webhook
router.post(
    "/razorpay/webhook",
    express.raw({ type: "*/*" }),
    razorpayWebhook
);

module.exports = router;
