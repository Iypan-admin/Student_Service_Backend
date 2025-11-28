// controllers/paymentWebhookController.js
const crypto = require("crypto");
const { supabaseAdmin } = require('../config/supabaseClient');

exports.razorpayWebhook = async (req, res) => {
    // 🔹 CRITICAL: Always respond 200 OK immediately to prevent Razorpay from disabling webhook
    // Even if there are errors, we must respond 200 first, then process asynchronously
    
    try {
        // ✅ Send response immediately (before any async operations)
        res.status(200).send("ok");
        
        // ✅ End the response to prevent any further writes
        res.end();
    } catch (responseError) {
        // If response already sent, ignore error
        console.error("Response error (ignored):", responseError);
    }

    // 🔹 Process webhook asynchronously (don't block the response)
    // Use process.nextTick to ensure response is sent first
    process.nextTick(async () => {
        try {
            const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
            const signature = req.headers["x-razorpay-signature"];
            const rawBody = req.body; // express.raw middleware must be used in route

            if (!secret) {
                console.error("❌ RAZORPAY_WEBHOOK_SECRET not configured");
                return;
            }

            if (!signature || !rawBody) {
                console.error("❌ Missing signature or body in webhook request");
                return;
            }

            // ✅ Verify Razorpay signature
            const expectedSignature = crypto
                .createHmac("sha256", secret)
                .update(rawBody)
                .digest("hex");

            if (signature !== expectedSignature) {
                console.error("❌ Invalid Razorpay signature - Webhook rejected (but 200 sent to prevent disable)");
                return; // Already sent 200, just log and exit
            }

            // ✅ Parse webhook body
            let body;
            try {
                body = JSON.parse(rawBody.toString());
            } catch (parseErr) {
                console.error("❌ Failed to parse webhook body:", parseErr);
                return;
            }

            const event = body.event;
            console.log("🔔 Webhook event received:", event);

            if (event === "payment.captured") {
                const payment = body.payload?.payment?.entity;
                
                if (!payment) {
                    console.error("❌ Payment entity not found in webhook payload");
                    return;
                }

                console.log("🔔 Webhook: Payment captured event received", payment.id);

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
                } = payment.notes || {};

                // 🔹 Validate required fields
                if (!enrollment_id || !payment.id) {
                    console.error("❌ Missing required fields (enrollment_id or payment_id)");
                    return;
                }

                // 🔹 Bank RRN / UPI fallback
                const bank_rrn = payment.acquirer_data?.rrn || payment.acquirer_data?.upi_transaction_id || null;

                console.log("🔔 Webhook: Processing payment", {
                    payment_id: payment.id,
                    enrollment_id,
                    registration_number,
                    amount: final_fees
                });

                // ✅ Check if payment already exists (prevent duplicates)
                const { data: existingPayment, error: checkError } = await supabaseAdmin
                    .from("student_course_payment")
                    .select("payment_id")
                    .eq("payment_id", payment.id)
                    .single();

                if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found (expected)
                    console.error("❌ Error checking existing payment:", checkError);
                    // Continue anyway - try to insert
                }

                // ✅ Insert only if payment doesn't exist (idempotent)
                if (existingPayment) {
                    console.log("✅ Payment already exists in DB (webhook), skipping insert");
                    return; // Already processed
                }

                // ✅ Insert into Supabase
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
                        payment_id: payment.id,
                        order_id: payment.order_id || null,
                        bank_rrn,
                        status: false // Admin approval pending (same as frontend verification)
                    }]);

                if (error) {
                    console.error("❌ Supabase insert error (webhook):", error.message, error.details);
                    // Log but don't throw - webhook already responded 200
                } else {
                    console.log("✅ Payment stored in DB via webhook:", {
                        payment_id: payment.id,
                        enrollment_id,
                        registration_number
                    });
                }
            } else {
                // ✅ Acknowledge all events (even if we don't process them)
                // This prevents Razorpay from disabling webhook for unhandled events
                console.log("ℹ️ Webhook event acknowledged (not payment.captured):", event);
            }

        } catch (err) {
            console.error("❌ Webhook processing error:", err);
            // Don't throw - webhook already responded 200 to prevent disable
            // Log error but don't let it propagate
        }
    });
};

// 🔹 Webhook Health Check Endpoint (for testing)
exports.webhookHealthCheck = async (req, res) => {
    try {
        res.status(200).json({ 
            success: true, 
            message: "Webhook endpoint is active",
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(200).json({ 
            success: true, 
            message: "Webhook endpoint is active (error logged)",
            timestamp: new Date().toISOString()
        });
    }
};
