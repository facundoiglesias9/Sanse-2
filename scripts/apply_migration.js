const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function applyMigration() {
    // Read env vars
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

    if (!urlMatch || !keyMatch) {
        console.error('❌ No se encontraron las credenciales en .env.local');
        process.exit(1);
    }

    const supabaseUrl = urlMatch[1].trim();
    const supabaseKey = keyMatch[1].trim();

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Aplicando migración: add_pagador_to_gastos.sql\n');

    // Execute the ALTER TABLE command
    const { data, error } = await supabase.rpc('exec', {
        query: `
            ALTER TABLE gastos 
            ADD COLUMN IF NOT EXISTS pagador_id UUID REFERENCES profiles(id);
            
            CREATE INDEX IF NOT EXISTS idx_gastos_pagador ON gastos(pagador_id);
        `
    });

    if (error) {
        console.error('❌ Error al aplicar migración:', error.message);
        console.log('\n⚠️  Necesitas ejecutar la migración manualmente:');
        console.log('\n1. Abre el Dashboard de Supabase');
        console.log('2. Ve a SQL Editor');
        console.log('3. Ejecuta este SQL:\n');
        console.log(fs.readFileSync('migrations/add_pagador_to_gastos.sql', 'utf8'));
        process.exit(1);
    } else {
        console.log('✅ Migración aplicada exitosamente!');
    }
}

applyMigration().catch(console.error);
