const express = require("express");
const {
    makePayment,
    getTransactions,

} = require("../controllers/paymentController");


const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ Student Makes a Payment
router.post("/", authMiddleware, makePayment);

// ✅ Get All Transactions of a Student
router.get("/", authMiddleware, getTransactions);





module.exports = router;
