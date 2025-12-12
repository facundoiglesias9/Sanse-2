
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    console.log("Searching for Facundo...");
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 100 });
    if (error) {
        console.error(error);
        return;
    }

    users.forEach(u => {
        const name = u.user_metadata?.nombre || '';
        const email = u.email || '';
        if (name.toLowerCase().includes('facundo') || email.toLowerCase().includes('facundo')) {
            console.log(`FOUND: ${email} (Name: ${name}) ID: ${u.id}`);
        } else {
            // Print everyone just in case
            console.log(`User: ${email} (Name: ${name})`);
        }
    });
}

main();
