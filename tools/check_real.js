const { createClient } = require('@supabase/supabase-js');

async function checkRealData() {
    const supabase = createClient('https://zopuisiwuxcxdozccnip.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI');

    const { data: solicitudes } = await supabase.from('solicitudes').select('*').eq('estado', 'entregado');
    if (!solicitudes) return;

    const realSolicitudes = solicitudes.filter(s => {
        const c = s.cliente.toLowerCase();
        return !c.includes('prueba') && !c.includes('test');
    });

    console.log("--- SOLICITUDES REALES ---");
    realSolicitudes.forEach(s => {
        console.log(`Cliente: ${s.cliente}, Total: ${s.total}, Items: ${s.items?.length}`);
        s.items?.forEach(i => {
            console.log(`  - ${i.nombre || i.perfume?.nombre} - Cant: ${i.cantidad} - TotalItem: ${i.total || i.precio_total}`);
        });
    });
}

checkRealData();
