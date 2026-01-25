const { createClient } = require('@supabase/supabase-js');

const url = 'https://zopuisiwuxcxdozccnip.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(url, key);

async function checkSchema() {
    try {
        console.log("Checking 'inventario'...");
        const { data: inv, error: invErr } = await supabase.from('inventario').select('*').limit(1);
        if (invErr) console.error(invErr);
        if (invErr) console.error(invErr);
        else console.log('Inventario keys:', inv.length ? Object.keys(inv[0]).join(', ') : []);

        console.log("\nChecking 'insumos'...");
        const { data: ins, error: insErr } = await supabase.from('insumos').select('*').limit(1);
        if (insErr) console.error(insErr);
        if (insErr) console.error(insErr);
        else console.log('Insumos keys:', ins.length ? Object.keys(ins[0]).join(', ') : []);

        console.log("\nChecking 'esencias'...");
        const { data: es, error: esErr } = await supabase.from('esencias').select('*').limit(1);
        if (esErr) console.error(esErr);
        else console.log('Esencias keys:', JSON.stringify(es.length ? Object.keys(es[0]) : []));
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
