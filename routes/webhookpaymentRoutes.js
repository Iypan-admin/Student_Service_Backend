// routes/webhookpaymentRoutes.js
const express = require("express");
const router = express.Router();
const { razorpayWebhook, webhookHealthCheck } = require("../controllers/paymentWebhookController");

// 🔹 Health check endpoint (GET request for testing)
router.get("/razorpay/webhook/health", webhookHealthCheck);

// ✅ Use express.raw({ type: "*/*" }) for Razorpay webhook
// ✅ CRITICAL: This must be before any JSON middleware
router.post(
    "/razorpay/webhook",
    express.raw({ type: "*/*" }),
    razorpayWebhook
);

module.exports = router;
