const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Export both as named exports and default export for backward compatibility
module.exports = supabase;
module.exports.supabase = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
