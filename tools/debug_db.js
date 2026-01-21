const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { count: vCount, error: vError } = await supabase.from('ventas').select('*', { count: 'exact', head: true });
    const { count: sCount, error: sError } = await supabase.from('solicitudes').select('*', { count: 'exact', head: true });

    console.log('Ventas count:', vCount, vError);
    console.log('Solicitudes count:', sCount, sError);

    if (vCount > 0) {
        const { data } = await supabase.from('ventas').select('*').limit(1);
        console.log('Venta sample:', JSON.stringify(data?.[0], null, 2));
    }
}

check();
