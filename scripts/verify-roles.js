
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('nombre, rol');

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    console.log("Profiles with roles:");
    profiles.forEach(p => {
        console.log(`- ${p.nombre} (${p.email}) : ${p.rol}`);
    });
}

main();
