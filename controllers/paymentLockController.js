const supabase = require('../config/supabaseClient');

/**
 * Lock the student's payment mode (full or emi)
 */
const lockPaymentMode = async (req, res) => {
    const { register_number, payment_type } = req.body;

    if (!register_number || !payment_type) {
        return res.status(400).json({ success: false, message: "Missing data" });
    }

    // Check if already locked
    const { data: existing, error: existingError } = await supabase
        .from('student_payment_lock')
        .select('*')
        .eq('register_number', register_number)
        .single();

    if (existing) {
        return res.status(409).json({ success: false, message: "Payment mode already locked" });
    }

    // Lock it
    const { data, error } = await supabase
        .from('student_payment_lock')
        .insert([{ register_number, payment_type }]);

    if (error) {
        return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data });
};


/**
 * Get locked payment mode for student
 */
const getLockedPaymentMode = async (req, res) => {
    const { register_number } = req.params;

    const { data, error } = await supabase
        .from('student_payment_lock')
        .select('*')
        .eq('register_number', register_number)
        .single();

    if (error) {
        return res.status(404).json({ success: false, message: "Not locked yet" });
    }

    return res.status(200).json({ success: true, data });
};

module.exports = {
    lockPaymentMode,
    getLockedPaymentMode,
};
