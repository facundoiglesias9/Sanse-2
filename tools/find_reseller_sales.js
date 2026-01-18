
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('ventas').select('*').eq('is_reseller_sale', true).order('created_at', { ascending: false }).limit(5).then(({ data, error }) => {
    if (error) { console.error(error); return; }
    console.log('RESELLER SALES:', data.length);
    data.forEach(s => console.log(`ID: ${s.id} | Cliente: ${s.cliente} | Total: ${s.precio_total} | Created: ${s.created_at}`));
});
