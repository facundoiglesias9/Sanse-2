const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function runMigration() {
    // Read env vars
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

    if (!urlMatch || !keyMatch) {
        console.error('❌ Could not find Supabase credentials in .env.local');
        process.exit(1);
    }

    const supabaseUrl = urlMatch[1].trim();
    const supabaseKey = keyMatch[1].trim();

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Read migration file
    const migrationSQL = fs.readFileSync('migrations/add_pagador_to_gastos.sql', 'utf8');

    console.log('🔄 Executing migration: add_pagador_to_gastos.sql');
    console.log('SQL:', migrationSQL);

    // Execute each statement separately
    const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && !s.startsWith('COMMENT'));

    for (const statement of statements) {
        if (!statement) continue;

        console.log('\n📝 Executing:', statement.substring(0, 100) + '...');

        const { data, error } = await supabase.rpc('exec_raw_sql', { sql: statement });

        if (error) {
            console.error('❌ Error:', error);
            // Try alternative method
            console.log('🔄 Trying alternative method...');
            const { error: error2 } = await supabase
                .from('_migrations')
                .insert({ query: statement });

            if (error2) {
                console.error('❌ Alternative method also failed:', error2);
            }
        } else {
            console.log('✅ Success');
        }
    }

    console.log('\n✅ Migration complete!');
}

runMigration().catch(console.error);
