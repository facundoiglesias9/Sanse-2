const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabase.from('insumos_categorias').select('id, nombre');
    if (error) {
        console.error(error);
        return;
    }
    const output = data.map(c => `${c.id} | ${c.nombre}`).join('\n');
    console.log(output);
    fs.writeFileSync('cats_debug.txt', output);
}

run();
