
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResellerSales() {
    const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('is_reseller_sale', true)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Recent reseller sales:', data.length);
        if (data.length > 0) {
            console.log('Sample:', data[0]);
        }
    }

    const { count, error: countError } = await supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true });

    console.log('Total sales:', count);
}

checkResellerSales();
