const { createClient } = require('@supabase/supabase-js');

async function debugVentasTable() {
    const supabase = createClient('https://zopuisiwuxcxdozccnip.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI');

    console.log("--- 20 REGISTROS DE TABLA VENTAS ---");
    const { data: ventas, error } = await supabase
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!ventas || ventas.length === 0) {
        console.log("No hay datos en la tabla ventas.");
    } else {
        ventas.forEach(v => {
            console.log(`ID: ${v.id} | Fecha: ${v.created_at} | Cliente: ${v.cliente} | Total: ${v.precio_total} | Items: ${v.perfumes}`);
        });
    }
}

debugVentasTable();
