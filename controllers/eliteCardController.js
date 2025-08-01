const supabase = require('../config/supabaseClient');

// Fetch elite card by registration number
const getEliteCardByRegNo = async (req, res) => {
    try {
        // Debug logs
        console.log("✅ Route hit: GET /elite-card/:registration_number");
        console.log("📥 Registration Number:", req.params.registration_number);

        const { registration_number } = req.params;

        // Supabase query
        const { data, error } = await supabase
            .from('student_elite_cards')
            .select('card_type, card_number')
            .eq('register_number', registration_number)
            .single(); // Assumes 1 row per student

        if (error) throw error;

        // Success response
        res.status(200).json({ success: true, data });

    } catch (error) {
        // Error response
        console.error('❌ Elite card fetch error:', error.message);
        res.status(404).json({ success: false, message: 'No elite card found' });
    }
};

module.exports = { getEliteCardByRegNo };
