
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env from .env.local manually since we are in a script
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = require('dotenv').config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (command === 'list') {
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) {
            console.error(error);
            return;
        }
        console.log(`Total users found: ${data.users.length}`);
        data.users.forEach(u => {
            console.log(`Email: ${u.email} | Name: ${u.user_metadata?.nombre} | Role: ${u.user_metadata?.rol}`);
        });
    } else if (command === 'set-admin') {
        const email = args[1];
        if (!email) {
            console.error("Please provide email");
            return;
        }

        // Find user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        const user = users.find(u => u.email === email);

        if (!user) {
            console.error("User not found");
            return;
        }

        const { error } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, rol: 'admin' }
        });

    } else if (command === 'set-admin-by-name') {
        const namePart = args[1];
        if (!namePart) {
            console.error("Please provide name part");
            return;
        }

        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        const user = users.find(u => u.user_metadata?.nombre?.toLowerCase().includes(namePart.toLowerCase()));

        if (!user) {
            console.log(`No user found matching "${namePart}"`);
            return;
        }

        console.log(`Found user: ${user.email} (${user.user_metadata.nombre}). Setting as ADMIN...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, rol: 'admin' }
        });

        if (updateError) console.error(updateError);
        else console.log(`User ${user.email} is now ADMIN.`);

    } else {
        console.log("Usage: node manage-roles.js [list | set-admin <email>]");
    }
}

main();
