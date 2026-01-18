
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResellerSales() {
    console.log('--- START ---');
    const { count: totalCount, error: totalError } = await supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true });

    console.log('Total sales count:', totalCount);

    const { count: resellerCount, error: resellerError } = await supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true })
        .eq('is_reseller_sale', true);

    console.log('Reseller sales count:', resellerCount);

    const { data: recent, error: recentError } = await supabase
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    console.log('Most recent 3 sales:');
    recent.forEach(s => console.log(`- ${s.created_at} | ${s.cliente} | ${s.precio_total} | Reseller: ${s.is_reseller_sale}`));
    console.log('--- END ---');
}

checkResellerSales();
