// controllers/razorpayController.js
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();
const { supabaseAdmin } = require("../config/supabaseClient");

// Initialize Razorpay client
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

// ---------------- CREATE ORDER ----------------
const createOrder = async (req, res) => {
    try {
        const {
            final_fees,
            registration_number,
            student_name,
            email,
            contact,
            course_name,
            course_duration,
            original_fees,
            discount_percentage,
            payment_type,
            emi_duration,
            current_emi,
            enrollment_id
        } = req.body;

        if (!final_fees) {
            return res.status(400).json({ success: false, message: "Final fees is required" });
        }

        const options = {
            amount: Math.round(final_fees * 100), // in paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                enrollment_id,
                registration_number,
                student_name,
                email,
                contact,
                course_name,
                course_duration,
                original_fees,
                discount_percentage,
                final_fees,
                payment_type,
                emi_duration,
                current_emi,
            }
        };

        const order = await razorpay.orders.create(options);

        console.log("✅ Razorpay order created:", order.id);
        console.log("📋 Order details:", {
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            status: order.status
        });

        return res.status(200).json({
            success: true,
            order,
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error("❌ Razorpay order error:", error);
        
        // 🔹 Check for domain-related errors
        const errorMessage = error.message || error.description || "";
        if (errorMessage.includes("website") || errorMessage.includes("domain") || errorMessage.includes("allowed")) {
            console.error("🔴 CRITICAL: Domain registration issue detected");
            return res.status(400).json({
                success: false,
                message: "Domain not registered in Razorpay dashboard. Please contact admin.",
                error_type: "DOMAIN_NOT_REGISTERED"
            });
        }
        
        return res.status(500).json({
            success: false,
            message: error.message || "Order creation failed",
        });
    }
};

// ---------------- VERIFY PAYMENT ----------------
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // ✅ Verify Signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            console.error("❌ Invalid signature");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        console.log("✅ Payment verified successfully");

        // ✅ Fetch Order (for notes)
        const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
        const notes = orderDetails.notes || {};
        console.log("🟢 Notes from Razorpay order:", notes);

        // ✅ Fetch Payment (for bank_rrn)
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        console.log("🟢 Razorpay payment details:", paymentDetails);

        const {
            enrollment_id,
            registration_number,
            student_name,
            email,
            contact,
            course_name,
            course_duration,
            original_fees,
            discount_percentage,
            final_fees,
            payment_type,
            emi_duration,
            current_emi
        } = notes;

        console.log("🟢 enrollment_id type:", typeof enrollment_id, "value:", enrollment_id);

        // ✅ Bank RRN fallback for Wallet / UPI
        const bank_rrn =
            paymentDetails.acquirer_data?.rrn ||
            paymentDetails.acquirer_data?.upi_transaction_id ||
            null;

        // ✅ Check if payment already exists (prevent duplicates)
        const { data: existingPayment } = await supabaseAdmin
            .from("student_course_payment")
            .select("payment_id")
            .eq("payment_id", razorpay_payment_id)
            .single();

        // ✅ Insert only if payment doesn't exist (idempotent)
        if (existingPayment) {
            console.log("✅ Payment already exists in DB, skipping insert");
            return res.json({
                success: true,
                message: "Payment already verified & stored",
                payment: existingPayment
            });
        }

        // ✅ Insert into Supabase
        const { data, error } = await supabaseAdmin
            .from("student_course_payment")
            .insert([{
                enrollment_id,
                registration_number,
                student_name,
                email,
                contact,
                course_name,
                course_duration: Number(course_duration) || 0,
                original_fees: Number(original_fees) || 0,
                discount_percentage: Number(discount_percentage) || 0,
                final_fees: Number(final_fees) || 0,
                payment_type: payment_type || "full",
                emi_duration: payment_type === "emi" ? Number(emi_duration) : null,
                current_emi: payment_type === "emi" ? Number(current_emi) : null,
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id,
                bank_rrn,
                status: false, // ✅ boolean false
            }]);

        if (error) {
            console.error("❌ Supabase insert error:", error.message, error.details);
            return res.status(500).json({ success: false, message: "DB insert failed" });
        }

        console.log("✅ Payment stored in DB:", data);

        return res.json({
            success: true,
            message: "Payment verified & stored",
            payment: data
        });
    } catch (error) {
        console.error("❌ Verify Payment Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// ---------------- GET PAYMENT STATUS FROM RAZORPAY (Manual Sync) ----------------
const getPaymentStatus = async (req, res) => {
    try {
        const { payment_id } = req.params;

        if (!payment_id) {
            return res.status(400).json({ success: false, message: "Payment ID is required" });
        }

        // ✅ Fetch payment from Razorpay API
        const paymentDetails = await razorpay.payments.fetch(payment_id);
        
        console.log("🔍 Payment status from Razorpay:", {
            payment_id: paymentDetails.id,
            status: paymentDetails.status,
            captured: paymentDetails.captured,
            amount: paymentDetails.amount / 100
        });

        // ✅ Check if payment exists in our DB
        const { data: dbPayment } = await supabaseAdmin
            .from("student_course_payment")
            .select("*")
            .eq("payment_id", payment_id)
            .single();

        // ✅ If payment is captured in Razorpay but not in DB, store it
        if (paymentDetails.status === "captured" && !dbPayment) {
            const orderDetails = await razorpay.orders.fetch(paymentDetails.order_id);
            const notes = orderDetails.notes || {};

            const {
                enrollment_id,
                registration_number,
                student_name,
                email,
                contact,
                course_name,
                course_duration,
                original_fees,
                discount_percentage,
                final_fees,
                payment_type,
                emi_duration,
                current_emi
            } = notes;

            if (enrollment_id) {
                const bank_rrn = paymentDetails.acquirer_data?.rrn || 
                                paymentDetails.acquirer_data?.upi_transaction_id || 
                                null;

                const { data, error } = await supabaseAdmin
                    .from("student_course_payment")
                    .insert([{
                        enrollment_id,
                        registration_number: registration_number || null,
                        student_name: student_name || null,
                        email: email || null,
                        contact: contact || null,
                        course_name: course_name || null,
                        course_duration: Number(course_duration) || 0,
                        original_fees: Number(original_fees) || 0,
                        discount_percentage: Number(discount_percentage) || 0,
                        final_fees: Number(final_fees) || 0,
                        payment_type: payment_type || "full",
                        emi_duration: payment_type === "emi" ? Number(emi_duration) : null,
                        current_emi: payment_type === "emi" ? Number(current_emi) : null,
                        payment_id: paymentDetails.id,
                        order_id: paymentDetails.order_id,
                        bank_rrn,
                        status: false
                    }]);

                if (error) {
                    console.error("❌ Error storing payment:", error);
                } else {
                    console.log("✅ Payment synced from Razorpay and stored in DB");
                }
            }
        }

        return res.json({
            success: true,
            payment: {
                razorpay_status: paymentDetails.status,
                captured: paymentDetails.captured,
                amount: paymentDetails.amount / 100,
                in_database: !!dbPayment,
                db_status: dbPayment?.status || null
            }
        });
    } catch (error) {
        console.error("❌ Get Payment Status Error:", error);
        if (error.statusCode === 404) {
            return res.status(404).json({ success: false, message: "Payment not found in Razorpay" });
        }
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

// ---------------- RECONCILE PAYMENTS (Find Missed Payments) ----------------
const reconcilePayments = async (req, res) => {
    try {
        const { enrollment_id, order_id } = req.query;

        if (!enrollment_id && !order_id) {
            return res.status(400).json({ 
                success: false, 
                message: "enrollment_id or order_id is required" 
            });
        }

        let razorpayPayments = [];

        if (order_id) {
            // ✅ Fetch order from Razorpay
            const orderDetails = await razorpay.orders.fetch(order_id);
            const payments = orderDetails.payments || [];
            
            for (const paymentId of payments) {
                try {
                    const payment = await razorpay.payments.fetch(paymentId);
                    if (payment.status === "captured") {
                        razorpayPayments.push(payment);
                    }
                } catch (err) {
                    console.error(`Error fetching payment ${paymentId}:`, err);
                }
            }
        } else {
            // ✅ Get all payments for enrollment from DB
            const { data: dbPayments } = await supabaseAdmin
                .from("student_course_payment")
                .select("order_id")
                .eq("enrollment_id", enrollment_id);

            const orderIds = [...new Set(dbPayments?.map(p => p.order_id).filter(Boolean) || [])];
            
            for (const oid of orderIds) {
                try {
                    const orderDetails = await razorpay.orders.fetch(oid);
                    const payments = orderDetails.payments || [];
                    
                    for (const paymentId of payments) {
                        try {
                            const payment = await razorpay.payments.fetch(paymentId);
                            if (payment.status === "captured") {
                                razorpayPayments.push(payment);
                            }
                        } catch (err) {
                            console.error(`Error fetching payment ${paymentId}:`, err);
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching order ${oid}:`, err);
                }
            }
        }

        // ✅ Check which payments are missing in DB
        const missingPayments = [];
        
        for (const payment of razorpayPayments) {
            const { data: existingPayment } = await supabaseAdmin
                .from("student_course_payment")
                .select("payment_id")
                .eq("payment_id", payment.id)
                .single();

            if (!existingPayment) {
                missingPayments.push({
                    payment_id: payment.id,
                    order_id: payment.order_id,
                    amount: payment.amount / 100,
                    status: payment.status,
                    created_at: payment.created_at
                });
            }
        }

        return res.json({
            success: true,
            total_razorpay_payments: razorpayPayments.length,
            missing_in_db: missingPayments.length,
            missing_payments: missingPayments
        });
    } catch (error) {
        console.error("❌ Reconcile Payments Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

module.exports = { createOrder, verifyPayment, getPaymentStatus, reconcilePayments };
