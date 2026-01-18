
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
    console.log('Checking columns in notas...');
    const { data, error: fetchError } = await supabase
        .from('notas')
        .select('*')
        .limit(1);

    if (fetchError) {
        console.error('Error fetching notas:', fetchError);
        return;
    }

    if (data.length > 0 && 'is_pinned' in data[0]) {
        console.log('Column is_pinned already exists.');
        return;
    }

    console.log('Column is_pinned missing. Please run this SQL in your Supabase SQL Editor:');
    console.log('ALTER TABLE notas ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;');

    // Attempting to run SQL if service role key is provided and we have a way (unlikely via REST)
    // Supabase JS doesn't support ALTER TABLE directly via the client easily without RPC or similar.
}

addColumn();
