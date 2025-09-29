// controllers/paymentWebhookController.js
const crypto = require("crypto");
const supabaseAdmin = require('../config/supabaseClient');

exports.razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];
        const rawBody = req.body; // express.raw middleware must be used in route

        // ✅ Verify Razorpay signature
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(rawBody)
            .digest("hex");

        if (signature !== expectedSignature) {
            console.error("❌ Invalid Razorpay signature");
            return res.status(400).send("Invalid signature");
        }

        // ✅ Immediately respond 200 to Razorpay
        res.status(200).send("ok");

        // ---- Process webhook asynchronously ----
        const body = JSON.parse(rawBody.toString());
        const event = body.event;

        if (event === "payment.captured") {
            const payment = body.payload.payment.entity;

            const {
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
            } = payment.notes || {};

            // 🔹 Bank RRN / UPI fallback
            const bank_rrn = payment.acquirer_data?.rrn || payment.acquirer_data?.upi_transaction_id || null;

            // ✅ Upsert into Supabase (idempotent)
            const { data, error } = await supabaseAdmin
                .from("student_course_payment")
                .upsert([{
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
                    payment_id: payment.id,
                    order_id: payment.order_id,
                    bank_rrn,
                    status: payment.status // "captured"
                }], { onConflict: ["payment_id"] }); // prevent duplicates if Razorpay retries

            if (error) {
                console.error("❌ Supabase insert error:", error);
                // Do NOT return 500, webhook already responded 200
            } else {
                console.log("✅ Payment stored in DB:", data);
            }
        } else {
            console.log("ℹ️ Event ignored:", event);
        }

    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        // Do NOT return 500, Razorpay already got 200
    }
};
