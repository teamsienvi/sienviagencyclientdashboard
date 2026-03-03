const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Iris/Downloads/';
const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('query-results-export-2026-02-25') && f.endsWith('.csv'))
    .sort();

for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = content.split('\n');
    const header = lines[0].trim();
    const sizeKB = Math.round(content.length / 1024);

    // Extract first few keys from the JSON data
    const line2 = lines[1] || '';
    const keys = [];
    const matches = line2.match(/""\w+""/g);
    if (matches) {
        const seen = new Set();
        for (const m of matches) {
            const key = m.replace(/""/g, '');
            if (!seen.has(key)) {
                seen.add(key);
                keys.push(key);
            }
            if (keys.length >= 10) break;
        }
    }

    console.log(`${f} | ${sizeKB}KB | header: ${header} | keys: ${keys.join(', ')}`);
}
