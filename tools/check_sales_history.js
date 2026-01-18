
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkSales() {
    const { data, error } = await supabase
        .from('ventas')
        .select('id, created_at, cliente, precio_total, is_reseller_sale')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        fs.writeFileSync('sales_check.txt', error.message);
    } else {
        fs.writeFileSync('sales_check.txt', JSON.stringify(data, null, 2));
    }
}

checkSales();
