const { createClient } = require('@supabase/supabase-js');

async function inspectData() {
    const supabase = createClient('https://zopuisiwuxcxdozccnip.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI');

    console.log("--- SOLICITUDES ENTREGADAS (CLIENTES E ITEMS) ---");
    const { data: solicitudes } = await supabase.from('solicitudes').select('cliente, items, created_at').eq('estado', 'entregado').order('created_at', { ascending: false });

    if (!solicitudes) {
        console.log("No se encontraron solicitudes");
        return;
    }

    const customers = new Set();
    const itemNames = new Set();
    const categories = new Set();

    solicitudes.forEach(s => {
        customers.add(s.cliente);
        if (s.items && Array.isArray(s.items)) {
            s.items.forEach(item => {
                const name = item.nombre || item.perfume?.nombre;
                const cat = item.insumos_categorias?.nombre || item.perfume?.insumos_categorias?.nombre || item.categoria;
                if (name) itemNames.add(name);
                if (cat) categories.add(cat);
            });
        }
    });

    console.log("Clientes:", Array.from(customers));
    console.log("Items:", Array.from(itemNames));
    console.log("Categorias:", Array.from(categories));
}

inspectData();
