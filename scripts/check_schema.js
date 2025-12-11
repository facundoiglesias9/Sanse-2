
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
    // Hacky way to list tables if specific endpoint not available, but usually we just guess
    // or checks specific common names.
    // Actually, I can just list 'insumos' columns to see if there's a price/quantity field.
    const { data: insumos, error } = await supabase.from('insumos').select('*').limit(1);
    if (error) console.error(error);
    else console.log('Insumos sample:', insumos);

    // Check for a link table
    const { data: linkTable, error: linkError } = await supabase.from('esencias_insumos').select('*').limit(1);
    if (linkError) console.log('esencias_insumos usually does not exist directly unless named so. Error:', linkError.message);
    else console.log('Found esencias_insumos', linkTable);
}

listTables();
