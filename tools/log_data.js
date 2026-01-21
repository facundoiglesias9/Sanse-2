const { createClient } = require('@supabase/supabase-js');

async function inspectData() {
    const supabase = createClient('https://zopuisiwuxcxdozccnip.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI');

    const { data: solicitudes } = await supabase.from('solicitudes').select('cliente, items, created_at').eq('estado', 'entregado');
    if (!solicitudes) return console.log("No data");

    const customers = [...new Set(solicitudes.map(s => s.cliente))];
    const itemNames = [];
    const categories = [];

    solicitudes.forEach(s => {
        if (s.items) {
            s.items.forEach(i => {
                const n = i.nombre || i.perfume?.nombre;
                const c = i.insumos_categorias?.nombre || i.perfume?.insumos_categorias?.nombre || i.categoria;
                if (n) itemNames.push(n);
                if (c) categories.push(c);
            });
        }
    });

    console.log("CLIENTES:", JSON.stringify(customers));
    console.log("ITEMS_UNICOS:", JSON.stringify([...new Set(itemNames)]));
    console.log("CATEGORIAS_UNICAS:", JSON.stringify([...new Set(categories)]));
}

inspectData();
