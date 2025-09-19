const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const studentRoutes = require('./routes/studentRoutes');
const batchRoutes = require('./routes/batchRoutes');
const classRoutes = require('./routes/classRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const studentFeesRoute = require('./routes/studentFeesRoute');
const paymentLockRoutes = require('./routes/paymentLockRoutes');
const razorpayRoutes = require("./routes/razorpayRoutes");
const webhookPaymentRoutes = require("./routes/webhookpaymentRoutes");

dotenv.config();

const app = express();
app.use(cors());

// ✅ Important: JSON parser apply panna vendiyathu *after* webhook
// Razorpay webhook needs raw body
app.use("/api/razorpay/webhook", webhookPaymentRoutes);

// ✅ For all other routes → JSON parser okay
app.use(express.json());

// ✅ Student, Batch, Class, Payment APIs
app.use('/api/students', studentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', studentFeesRoute);
app.use('/api/payment-lock', paymentLockRoutes);

// ✅ Razorpay APIs
app.use("/api/razorpay", razorpayRoutes);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
