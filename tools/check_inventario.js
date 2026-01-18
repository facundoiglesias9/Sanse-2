
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventario() {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data.length > 0) {
            const keys = Object.keys(data[0]);
            console.log('COLUMNS_LIST: ' + keys.join('|'));
        } else {
            console.log('No data found');
        }
    }
}

checkInventario();
