
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testInsert() {
    const sale = {
        created_at: new Date().toISOString(),
        cliente: "Prueba Manual 1",
        cantidad_perfumes: 4,
        precio_total: 55800,
        perfumes: "Test description",
        is_reseller_sale: true,
        metodo_pago: "Efectivo"
    };

    console.log('Inserting:', sale);
    const { data, error } = await supabase.from("ventas").insert(sale).select();

    if (error) {
        console.error('INSERT ERROR:', error);
    } else {
        console.log('INSERT SUCCESS:', data);
    }
}

testInsert();
