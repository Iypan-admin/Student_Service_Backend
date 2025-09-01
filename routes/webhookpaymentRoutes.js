// routes/webhookpaymentRoutes.js
const express = require("express");
const router = express.Router();
const { razorpayWebhook } = require("../controllers/paymentWebhookController");

// ✅ use express.raw instead of express.json
router.post(
    "/razorpay/webhook",
    express.raw({ type: "application/json" }),
    razorpayWebhook
);

module.exports = router;
