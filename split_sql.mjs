import { readFileSync, writeFileSync } from 'fs';

const sql = readFileSync('import_data.sql', 'utf8');

// Split by table comment markers
const sections = [];
let currentSection = { name: 'header', content: '' };

for (const line of sql.split('\n')) {
    // Detect table comment markers like "-- shopify_oauth_connections: 3 rows"
    const tableMatch = line.match(/^-- (\w+): (\d+) rows$/);
    if (tableMatch) {
        if (currentSection.content.trim()) {
            sections.push(currentSection);
        }
        currentSection = { name: tableMatch[1], content: line + '\n' };
    } else {
        currentSection.content += line + '\n';
    }
}
if (currentSection.content.trim()) {
    sections.push(currentSection);
}

// Write individual table files
let index = 1;
for (const section of sections) {
    if (section.name === 'header') continue;
    const filename = `import_${String(index).padStart(2, '0')}_${section.name}.sql`;
    writeFileSync(filename, section.content, 'utf8');
    const sizeKB = Math.round(section.content.length / 1024);
    console.log(`${filename} (${sizeKB}KB)`);
    index++;
}

console.log('\nDone! Files split by table.');
