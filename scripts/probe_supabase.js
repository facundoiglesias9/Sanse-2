
const https = require('https');

const supabaseUrl = 'https://zopuisiwuxcxdozccnip.supabase.co';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcHVpc2l3dXhjeGRvemNjbmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU3MTE0NzgsImV4cCI6MjA2MTI4NzQ3OH0.Ff5lE-IKQcTzH8BM850Nqf5AQBChBwnw49KoElfdmcI';

const tables = ['products', 'productos', 'items', 'inventory', 'inventario', 'prices', 'precios'];

function fetchTable(tableName) {
    return new Promise((resolve) => {
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
                    resolve({ table: tableName, status: res.statusCode, data: data });
                } else {
                    resolve({ table: tableName, status: res.statusCode });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ table: tableName, error: e.message });
        });
        req.end();
    });
}

async function main() {
    console.log('Probing Supabase tables...');
    for (const table of tables) {
        const result = await fetchTable(table);
        if (result.status === 200) {
            console.log(`FOUND TABLE: ${result.table}`);
            console.log('Sample Data:', result.data);
        } else {
            // console.log(`Table ${table} not found or error: ${result.status}`);
        }
    }
}

main();
