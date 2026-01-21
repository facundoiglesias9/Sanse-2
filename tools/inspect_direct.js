const { createClient } = require('@supabase/supabase-js');

async function inspectData() {
    const supabase = createClient('https://zopuisiwuxcxdozccnip.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI');

    console.log("--- ULTIMAS 5 VENTAS ---");
    const { data: ventas } = await supabase.from('ventas').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(ventas, null, 2));

    console.log("\n--- ULTIMAS 5 SOLICITUDES ENTREGADAS ---");
    const { data: solicitudes } = await supabase.from('solicitudes').select('*').eq('estado', 'entregado').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(solicitudes, null, 2));

    console.log("\n--- CLIENTES EN VENTAS ---");
    const { data: clientes } = await supabase.from('ventas').select('cliente').limit(20);
    console.log('Clientes found:', [...new Set(clientes?.map(c => c.cliente))]);
}

inspectData();
