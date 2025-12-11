
const https = require('https');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI';

const tableName = process.argv[2];

if (!tableName) {
    console.error('Please provide a table name argument');
    process.exit(1);
}

const options = {
    hostname: 'zopuisiwuxcxdozccnip.supabase.co',
    path: `/rest/v1/${tableName}?select=*&limit=1`,
    method: 'GET',
    headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Data for table '${tableName}':`);
            console.log(data);
        } else {
            console.error(`Error fetching table '${tableName}': Status ${res.statusCode}`, data);
        }
    });
});

req.on('error', (e) => {
    console.error(e);
});
req.end();
