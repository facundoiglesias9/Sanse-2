
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMargen() {
    const { data, error } = await supabase.from('esencias').select('margen').limit(1);
    if (error) {
        console.log("Error selecting margen:", error.message);
    } else {
        console.log("Success selecting margen. Data:", data);
    }
}

checkMargen();
