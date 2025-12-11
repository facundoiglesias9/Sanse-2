
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkInsumos() {
    const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching insumos:', error);
        return;
    }

    console.log('Insumo structure:', Object.keys(data[0]));
    console.log('Sample Insumo:', data[0]);
}

checkInsumos();
