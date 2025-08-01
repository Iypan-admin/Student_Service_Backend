const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const studentRoutes = require('./routes/studentRoutes');
const batchRoutes = require('./routes/batchRoutes');
const classRoutes = require('./routes/classRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const studentFeesRoute = require('./routes/studentFeesRoute');
const paymentLockRoutes = require('./routes/paymentLockRoutes');




dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/students', studentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', studentFeesRoute);
app.use('/api/payment-lock', paymentLockRoutes);



const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
