
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    // There isn't a direct "list tables" in JS client easily without permissions on information_schema, 
    // but we can try to select from expected tables to see if they error.

    const tablesToCheck = ['esencias', 'insumos', 'insumos_categorias'];

    for (const table of tablesToCheck) {
        const { data, error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            console.log(`Table '${table}': ERROR/MISSING (${error.message})`);
        } else {
            console.log(`Table '${table}': EXISTS`);
        }
    }

    // Check columns of esencias
    const { data: esenciasData, error: esenciasError } = await supabase.from('esencias').select('*').limit(1);
    if (esenciasData && esenciasData.length > 0) {
        console.log("Esencias columns:", Object.keys(esenciasData[0]));
    }
}

listTables();
