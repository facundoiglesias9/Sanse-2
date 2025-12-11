const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkTable() {
    // Read env vars
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

    const supabaseUrl = urlMatch[1].trim();
    const supabaseKey = keyMatch[1].trim();

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check current structure
    console.log('🔍 Checking gastos table structure...\n');

    const { data, error } = await supabase
        .from('gastos')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error:', error);
    } else {
        console.log('✅ Sample row from gastos:');
        console.log(JSON.stringify(data, null, 2));

        if (data && data.length > 0) {
            console.log('\n📋 Columns in gastos table:');
            console.log(Object.keys(data[0]));

            if ('pagador_id' in data[0]) {
                console.log('\n✅ Column pagador_id EXISTS');
            } else {
                console.log('\n❌ Column pagador_id DOES NOT EXIST');
                console.log('\n🔧 You need to run the migration manually in Supabase Dashboard or using supabase CLI');
            }
        }
    }
}

checkTable().catch(console.error);
