
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('solicitudes').select('*').eq('estado', 'entregado').order('created_at', { ascending: false }).limit(5).then(({ data, error }) => {
    if (error) { fs.writeFileSync('entregados.txt', error.message); return; }
    fs.writeFileSync('entregados.txt', JSON.stringify(data, null, 2));
});
