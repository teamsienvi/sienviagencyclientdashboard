import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = 'c:/Users/Iris/Downloads/';
const files = readdirSync(dir)
    .filter(f => f.startsWith('query-results-export-2026-02-25') && f.endsWith('.csv'))
    .sort();

const results = [];

for (const f of files) {
    const content = readFileSync(join(dir, f), 'utf8');
    const lines = content.split('\n');
    const header = lines[0].trim();
    const sizeKB = Math.round(content.length / 1024);

    const line2 = lines[1] || '';
    const keys = [];
    const regex = /""(\w+)""/g;
    let match;
    const seen = new Set();
    while ((match = regex.exec(line2)) !== null && keys.length < 15) {
        const key = match[1];
        if (!seen.has(key)) {
            seen.add(key);
            keys.push(key);
        }
    }

    results.push(`${f}\n  size: ${sizeKB}KB\n  header: ${header}\n  keys: ${keys.join(', ')}\n`);
}

writeFileSync('csv_analysis.txt', results.join('\n'), 'utf8');
console.log('Done - wrote csv_analysis.txt');
