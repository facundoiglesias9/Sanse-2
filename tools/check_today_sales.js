
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const today = new Date();
today.setHours(0, 0, 0, 0);

supabase.from('ventas').select('*').gte('created_at', today.toISOString()).then(({ data, error }) => {
    if (error) { console.error(error); return; }
    console.log('SALES TODAY:', data.length);
    data.forEach(s => console.log(`- ${s.cliente} | ${s.precio_total} | ${s.is_reseller_sale}`));
});
