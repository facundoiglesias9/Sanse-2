
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkNotNull() {
    const { error } = await supabase.from('ventas').insert({});
    if (error) {
        fs.writeFileSync('error_details.txt', JSON.stringify(error, null, 2));
    } else {
        fs.writeFileSync('error_details.txt', 'No error?');
    }
}

checkNotNull();
