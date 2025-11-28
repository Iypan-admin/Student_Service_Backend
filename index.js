const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const studentRoutes = require('./routes/studentRoutes');
const batchRoutes = require('./routes/batchRoutes');
const classRoutes = require('./routes/classRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const studentFeesRoute = require('./routes/studentFeesRoute');
const paymentLockRoutes = require('./routes/paymentLockRoutes');
const notificationsRouter = require("./routes/notifications");
const razorpayRoutes = require("./routes/razorpayRoutes");
const webhookPaymentRoutes = require("./routes/webhookpaymentRoutes");

dotenv.config();

const app = express();
app.use(cors());

// ✅ Razorpay webhook needs raw body
app.use("/api/razorpay/webhook", webhookPaymentRoutes);

// ✅ JSON parser for all other routes
app.use(express.json());

// ✅ Student, Batch, Class, Payment APIs
app.use('/api/students', studentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/classes', classRoutes);
app.use('/api', studentFeesRoute);
app.use('/api/payment-lock', paymentLockRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/payments", paymentRoutes);

// ✅ Razorpay APIs
app.use("/api/razorpay", razorpayRoutes);

// 🔔 Load EMI expiry notification cron job
require("./cron/emiExpiryNotifications");

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Global error handler (optional)
// ✅ IMPORTANT: Exclude webhook route from global error handler to prevent webhook disable
app.use((err, req, res, next) => {
    // ✅ Skip error handling for webhook routes (they handle their own errors)
    if (req.path.includes('/razorpay/webhook')) {
        return next(); // Don't interfere with webhook
    }
    console.error("Global error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
