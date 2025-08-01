const supabase = require('../config/supabaseClient');

// ✅ Get Batches by Center
const getBatchesByCenter = async (req, res) => {
    const { center } = req.body; // Extract center ID from request body

    if (!center) {
        return res.status(400).json({ error: 'Center ID is required' });
    }

    const { data: batches, error } = await supabase
        .from('batches')
        .select('*')
        .eq('center', center);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ batches });
};


// ✅ Enroll Student in Batch
const enrollStudent = async (req, res) => {
    const { student_id } = req.body; // Decoded from JWT
    const { batch_id } = req.body;

    if (!batch_id) {
        return res.status(400).json({ error: 'Batch ID is required' });
    }

    const { data, error } = await supabase
        .from('enrollment')
        .insert([{ 
            student: student_id, 
            batch: batch_id, 
            status: false  // Default value
        }]);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Enrollment successful, pending approval' });
};

// ✅ Get All Batches the Student is Enrolled In
const getEnrolledBatches = async (req, res) => {
    const { student_id } = req.student; // Decoded from JWT

    // Fetch student enrollments with batch details
    let { data: enrollments, error } = await supabase
        .from('enrollment')
        .select(`
            enrollment_id, created_at, student, status, end_date, 
            batches (
                batch_id, batch_name, created_at, duration,
                courses (
                    course_name, type, language, level, mode, program
                ),
                centers (center_id, center_name), 
                teachers (teacher_id, users (name))
            )
        `)
        .eq('student', student_id);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // Get current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check for expired enrollments and update status if needed
    for (let enrollment of enrollments) {
        if (enrollment.end_date && enrollment.end_date < currentDate) {
            // Update status to false
            await supabase
                .from('enrollment')
                .update({ status: false })
                .eq('enrollment_id', enrollment.enrollment_id);

            enrollment.status = false; // Update local object for response
        }
    }

    res.json({ enrollments });
};

module.exports = { getBatchesByCenter, enrollStudent, getEnrolledBatches };
