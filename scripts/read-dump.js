
const fs = require('fs');
const path = require('path');
console.log(fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8'));
