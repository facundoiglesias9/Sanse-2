
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkEssence() {
    const { data, error } = await supabase
        .from('esencias')
        .select(`
        id, 
        nombre, 
        precio_usd, 
        precio_ars, 
        proveedores (
            id,
            nombre,
            gramos_configurados
        )
    `)
        .ilike('nombre', '%On Ice%');

    if (error) {
        console.error('Error fetching essence:', error);
        return;
    }

    console.log('Essence Data:', JSON.stringify(data, null, 2));
}

checkEssence();
