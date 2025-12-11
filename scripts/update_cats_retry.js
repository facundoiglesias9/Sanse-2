const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 2. Ensure other categories exist
    const catsToEnsure = ["Limpia Pisos 5L", "Difusor", "Otro"];

    // Check what exists first
    const { data: existing } = await supabase.from('insumos_categorias').select('nombre');
    const existingNames = existing.map(c => c.nombre);
    console.log("Existing categories:", existingNames);

    for (const name of catsToEnsure) {
        if (!existingNames.includes(name)) {
            console.log(`Attempting to insert ${name}...`);
            const { data, error: insertError } = await supabase.from('insumos_categorias').insert({
                nombre: name,
                created_by: '63b939ab-d077-400a-acd2-89791a9fb8df',
                updated_by: '63b939ab-d077-400a-acd2-89791a9fb8df',
                updated_at: new Date().toISOString()
            }).select();

            if (insertError) {
                require('fs').writeFileSync('error_dump.json', JSON.stringify(insertError, null, 2));
                console.error("Error written to error_dump.json");
            } else {
                console.log(`Inserted ${name}:`, data);
            }
        }
    }
}

run();
