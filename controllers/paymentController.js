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

    // 1. Verify Razorpay signature
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== req.headers["x-razorpay-signature"]) {
        return res.status(400).json({ error: "Invalid signature" });
    }

    try {
        const payload = req.body;

        // 2. Extract payment details
        const transaction_id = payload.payload.payment.entity.id;
        const enrollment_id = payload.payload.payment.entity.notes.enrollment_id;

        if (!enrollment_id) {
            return res.status(400).json({ error: "Missing enrollment_id in Razorpay notes." });
        }

        // 🔑 Find last duration for this enrollment
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

        // 3. Insert into transactions table
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

        if (error) throw error;

        res.status(200).json({ message: "Payment recorded via Razorpay", transaction: data });
    } catch (err) {
        res.status(500).json({ error: "Webhook processing failed", details: err.message });
    }
};

module.exports = { makePayment, getTransactions, razorpayWebhook };
