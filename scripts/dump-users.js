
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 100 });
    if (error) {
        console.error(error);
        return;
    }

    const output = users.map(u => `Email: ${u.email} | ID: ${u.id} | Metadata: ${JSON.stringify(u.user_metadata)}`).join('\n');
    fs.writeFileSync('emails_dump.txt', output);
    console.log("Dumped to emails_dump.txt");
}

main();
