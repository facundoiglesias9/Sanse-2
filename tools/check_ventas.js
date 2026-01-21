const { createClient } = require('@supabase/supabase-js');

async function checkVentas() {
    const supabase = createClient('https://zopuisiwuxcxdozccnip.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI');

    console.log("--- CLIENTES EN TABLA VENTAS (NO PRUEBA) ---");
    const { data: ventas } = await supabase.from('ventas').select('cliente, created_at').order('created_at', { ascending: false });

    const realVentas = ventas?.filter(v => {
        const c = v.cliente?.toLowerCase() || "";
        return c && !c.includes('prueba') && !c.includes('test');
    });

    console.log(realVentas?.slice(0, 10));
}

checkVentas();
