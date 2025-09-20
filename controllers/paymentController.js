const supabase = require("../config/supabaseClient");
const crypto = require("crypto");

// ✅ Process a New Payment (Manual Entry by Student)
const makePayment = async (req, res) => {
    const { enrollment_id, transaction_id } = req.body;

    // Get student ID from decoded token
    const student_id = req.student.student_id;

    if (!enrollment_id || !transaction_id) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        // Check if enrollment exists for this student
        const { data: enrollment, error: enrollError } = await supabase
            .from("enrollment")
            .select("*")
            .eq("enrollment_id", enrollment_id)
            .eq("student", student_id)
            .single();

        if (enrollError || !enrollment) {
            return res.status(404).json({ error: "Enrollment not found for this student." });
        }

        // 🔑 Find last duration (for EMI auto increment)
        const { data: lastPayment } = await supabase
            .from("transactions")
            .select("duration")
            .eq("enrollment_id", enrollment_id)
            .order("duration", { ascending: false })
            .limit(1);

        let nextDuration = 1;
        if (lastPayment && lastPayment.length > 0) {
            nextDuration = lastPayment[0].duration + 1;
        }

        // Insert new payment
        const { data, error } = await supabase
            .from("transactions")
            .insert([
                {
                    enrollment_id,
                    transaction_id,
                    duration: nextDuration,
                    status: false, // Admin approval required
                },
            ])
            .select();

        if (error) throw error;

        res.status(201).json({ message: "Payment request submitted", transaction: data });
    } catch (err) {
        res.status(500).json({ error: "Payment failed", details: err.message });
    }
};

// ✅ Get All Transactions for a Student
const getTransactions = async (req, res) => {
    const student_id = req.student.student_id;

    try {
        const { data, error } = await supabase
            .from("transactions")
            .select("*, enrollment!inner(*)")
            .eq("enrollment.student", student_id);

        if (error) throw error;

        res.json({ transactions: data });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch transactions", details: err.message });
    }
};

// ✅ Razorpay Webhook (Auto Insert on Payment Success)
const razorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    try {
        // 1️⃣ Verify Razorpay signature
        const shasum = crypto.createHmac("sha256", secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest("hex");

        if (digest !== req.headers["x-razorpay-signature"]) {
            console.error("❌ Invalid Razorpay signature");
            // ✅ Still respond 200 to prevent webhook disable
            return res.status(200).json({ error: "Invalid signature" });
        }

        // ✅ Acknowledge Razorpay immediately
        res.status(200).json({ message: "Webhook received" });

        const payload = req.body;
        const transaction_id = payload.payload.payment.entity.id;
        const enrollment_id = payload.payload.payment.entity.notes.enrollment_id;

        if (!enrollment_id) {
            console.error("❌ Missing enrollment_id in Razorpay notes.");
            return; // already sent 200 OK
        }

        // 🔹 Insert DB in background
        process.nextTick(async () => {
            try {
                // Find last duration
                const { data: lastPayment } = await supabase
                    .from("transactions")
                    .select("duration")
                    .eq("enrollment_id", enrollment_id)
                    .order("duration", { ascending: false })
                    .limit(1);

                let nextDuration = 1;
                if (lastPayment && lastPayment.length > 0) {
                    nextDuration = lastPayment[0].duration + 1;
                }

                // Insert transaction
                const { data, error } = await supabase
                    .from("transactions")
                    .insert([
                        {
                            enrollment_id,
                            transaction_id,
                            duration: nextDuration,
                            status: false,
                        },
                    ])
                    .select();

                if (error) console.error("❌ Supabase insert error:", error);
                else console.log("✅ Payment recorded via Razorpay:", data);
            } catch (err) {
                console.error("❌ Background DB error:", err);
            }
        });
    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        // ✅ Still respond 200 to Razorpay
        res.status(200).json({ error: "Webhook error logged" });
    }
};

module.exports = { makePayment, getTransactions, razorpayWebhook };
