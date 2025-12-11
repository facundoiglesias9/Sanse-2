const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // 1. Rename existing "Limpia pisos" to "Limpia Pisos 1L"
    const { error: updateError } = await supabase
        .from('insumos_categorias')
        .update({ nombre: 'Limpia Pisos 1L' })
        .eq('nombre', 'Limpia pisos');

    if (updateError) console.error("Update error:", updateError);
    else console.log("Renamed 'Limpia pisos' to 'Limpia Pisos 1L'");

    // 2. Ensure other categories exist
    const catsToEnsure = ["Limpia Pisos 5L", "Difusor", "Otro", "Auto (Aromatizante)"];

    // Check what exists first
    const { data: existing } = await supabase.from('insumos_categorias').select('nombre');
    const existingNames = existing.map(c => c.nombre);

    for (const name of catsToEnsure) {
        // Special check for aromatizante to avoid duplicating if named "Aromatizante"
        if (name === "Auto (Aromatizante)" && existingNames.includes("Aromatizante")) {
            console.log("Aromatizante already exists (as Aromatizante). Skipping rename for now unless requested.");
            continue;
        }

        if (!existingNames.includes(name)) {
            const { error: insertError } = await supabase.from('insumos_categorias').insert({
                nombre: name,
                created_by: '4febd601-91a2-4b8f-b8df-021963404426' // hardcoded or irrelevant for admin script
            });
            if (insertError) console.error(`Error inserting ${name}:`, insertError);
            else console.log(`Inserted ${name}`);
        } else {
            console.log(`${name} already exists.`);
        }
    }
}

run();
