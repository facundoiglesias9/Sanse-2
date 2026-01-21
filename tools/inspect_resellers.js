const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function inspectRel() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    console.log("--- ONE VENTA ---");
    const { data: ventas } = await supabase.from('ventas').select('*').limit(1);
    console.log(ventas);

    console.log("--- PROFILES ---");
    const { data: profiles } = await supabase.from('profiles').select('*');
    console.log(profiles);
}

inspectRel();
