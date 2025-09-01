// controllers/paymentWebhookController.js
const crypto = require("crypto");
const supabaseAdmin = require('../config/supabaseClient');

exports.razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];
        const body = req.body; // raw body signature already handled by express.raw

        // ✅ Verify signature
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(JSON.stringify(body))
            .digest("hex");

        if (signature !== expectedSignature) {
            console.error("❌ Invalid Razorpay signature");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        const event = body.event;
        if (event === "payment.captured") {
            const payment = body.payload.payment.entity;

            // 🔹 Notes la namma details
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
            } = payment.notes;

            // ✅ Insert into DB
            const { data, error } = await supabaseAdmin
                .from("student_course_payment")
                .insert([
                    {
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
                        bank_rrn: payment.acquirer_data?.rrn || null,
                        status: payment.status // "captured"
                    }
                ]);

            if (error) {
                console.error("❌ Supabase insert error:", error);
                return res.status(500).json({ success: false, error });
            }

            console.log("✅ Payment stored in DB:", data);
            return res.json({ success: true });
        }

        return res.json({ success: true, message: "Event ignored" });
    } catch (err) {
        console.error("❌ Webhook error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
};
