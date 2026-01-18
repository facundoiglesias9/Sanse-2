
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('ventas').select('*').limit(1).then(({ data, error }) => {
    if (error) { fs.writeFileSync('schema_output.txt', error.message); return; }
    fs.writeFileSync('schema_output.txt', Object.keys(data[0]).join('\n'));
});
