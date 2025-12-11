
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTcxMTQ3OCwiZXhwIjoyMDYxMjg3NDc4fQ.knpcFpOshTEgazVld7_ObrDtcXeYAhz1tqIrb4eJpPo';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function backupTable(tableName) {
    console.log(`Backing up ${tableName}...`);
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
        console.error(`Error backing up ${tableName}:`, error);
        return;
    }
    fs.writeFileSync(`backup_${tableName}_${Date.now()}.json`, JSON.stringify(data, null, 2));
    console.log(`Backup of ${tableName} saved.`);
}

async function runBackups() {
    await backupTable('esencias');
    await backupTable('insumos');
    await backupTable('insumos_categorias');
}

runBackups();
