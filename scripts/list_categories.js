const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listCategories() {
    const { data, error } = await supabase
        .from('insumos_categorias')
        .select('id, nombre');

    if (error) {
        console.error('Error fetching categories:', error);
        return;
    }

    console.log('Categories:', data);
}

listCategories();
