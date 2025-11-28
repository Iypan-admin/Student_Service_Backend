const express = require("express");
const { createOrder, verifyPayment, getPaymentStatus, reconcilePayments } = require("../controllers/razorpayController");

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);   // 👈 Important
router.get("/status/:payment_id", getPaymentStatus);  // 🔹 Advanced: Manual payment status sync
router.get("/reconcile", reconcilePayments);  // 🔹 Advanced: Find missed payments

module.exports = router;
