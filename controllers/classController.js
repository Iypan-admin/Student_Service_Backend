const supabase = require("../config/supabaseClient");

// Fetch notes by batch_id
const getNotesByBatch = async (req, res) => {
    const { batch_id } = req.params;

    const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("batch_id", batch_id);

    if (error) {
        return res.status(500).json({ error: "Error fetching notes", details: error.message });
    }

    return res.status(200).json(data);
};

// Fetch GMeets by batch_id
const getGMeetsByBatch = async (req, res) => {
    const { batch_id } = req.params;

    const { data, error } = await supabase
        .from("gmeets")
        .select("*")
        .eq("batch_id", batch_id);

    if (error) {
        return res.status(500).json({ error: "Error fetching GMeets", details: error.message });
    }

    return res.status(200).json(data);
};

module.exports = { getNotesByBatch, getGMeetsByBatch };
