const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data } = await supabase.from('insumos_categorias').select('*').limit(1);
    if (data && data[0]) {
        console.log("Keys:", Object.keys(data[0]).join(", "));
    }
}
run();
