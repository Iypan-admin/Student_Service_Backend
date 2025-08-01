const supabase = require("../config/supabaseClient");

// ✅ Process a New Payment
const makePayment = async (req, res) => {
    const { enrollment_id, transaction_id, duration } = req.body;

    // Get student ID from decoded token
    const student_id = req.student.student_id;

    if (!enrollment_id || !transaction_id || !duration) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        // Check if enrollment exists
        const { data: enrollment, error: enrollError } = await supabase
            .from("enrollment")
            .select("*")
            .eq("enrollment_id", enrollment_id)
            .eq("student", student_id)
            .single();

        if (enrollError || !enrollment) {
            return res.status(404).json({ error: "Enrollment not found for this student." });
        }

        // Insert payment transaction
        const { data, error } = await supabase
            .from("transactions")
            .insert([
                {
                    enrollment_id,
                    transaction_id,
                    duration,
                    status: false, // Default: False, Admin will approve
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
        // Fetch transactions where the student's enrollment matches
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




module.exports = { makePayment, getTransactions };
