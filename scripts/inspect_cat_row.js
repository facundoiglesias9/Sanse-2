const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // Actually standard PostgREST doesn't expose schema via API clearly without permissions, 
    // but we can just try to insert with a dummy and see the precise error message.
    // Or we can just read *one* row fully to see what columns it has.

    const { data } = await supabase.from('insumos_categorias').select('*').limit(1);
    console.log("Full row:", JSON.stringify(data[0], null, 2));
}

run();
