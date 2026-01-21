const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function inspectData() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    console.log("--- ULTIMAS 10 VENTAS ---");
    const { data: ventas } = await supabase.from('ventas').select('*').order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(ventas, null, 2));

    console.log("\n--- ULTIMAS 10 SOLICITUDES ENTREGADAS ---");
    const { data: solicitudes } = await supabase.from('solicitudes').select('*').eq('estado', 'entregado').order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(solicitudes, null, 2));

    console.log("\n--- CONTEO POR TABLA ---");
    const { count: vCount } = await supabase.from('ventas').select('*', { count: 'exact', head: true });
    const { count: sCount } = await supabase.from('solicitudes').select('*', { count: 'exact', head: true });
    console.log('Ventas totals:', vCount);
    console.log('Solicitudes totals:', sCount);
}

inspectData();
