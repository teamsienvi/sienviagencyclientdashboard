import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dir = 'c:/Users/Iris/Downloads/';

// Map each CSV to its target table
const fileTableMap = [
    { file: 'query-results-export-2026-02-25_05-09-27.csv', table: 'shopify_oauth_connections' },
    { file: 'query-results-export-2026-02-25_05-11-10.csv', table: 'user_roles' },
    { file: 'query-results-export-2026-02-25_05-11-26.csv', table: 'social_oauth_accounts_youtube_x' },
    { file: 'query-results-export-2026-02-25_05-11-48.csv', table: 'social_oauth_accounts_meta' },
    { file: 'query-results-export-2026-02-25_05-12-08.csv', table: 'social_account_demographics' },
    { file: 'query-results-export-2026-02-25_05-22-19.csv', table: 'reports' },
    { file: 'query-results-export-2026-02-25_05-22-36.csv', table: 'social_account_metrics' },
    { file: 'query-results-export-2026-02-25_05-22-53.csv', table: 'social_follower_timeline' },
    { file: 'query-results-export-2026-02-25_05-23-09.csv', table: 'social_content' },
];

function parseJsonAggCsv(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    // Skip header line (json_agg)
    // The rest is one big CSV cell containing a JSON array
    // The CSV wraps it in quotes and escapes internal quotes by doubling them
    let jsonStr = lines.slice(1).join('\n').trim();

    // Remove surrounding CSV quotes if present
    if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        jsonStr = jsonStr.slice(1, -1);
    }

    // Unescape doubled quotes from CSV encoding
    jsonStr = jsonStr.replace(/""/g, '"');

    try {
        const data = JSON.parse(jsonStr);
        return data;
    } catch (e) {
        console.error(`Failed to parse ${filePath}: ${e.message}`);
        // Try to show where the error is
        const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
        if (pos > 0) {
            console.error(`  Context around position ${pos}: ...${jsonStr.substring(Math.max(0, pos - 50), pos + 50)}...`);
        }
        return null;
    }
}

function escapeSQL(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        // JSON objects/arrays
        return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    }
    // String
    return `'${String(val).replace(/'/g, "''")}'`;
}

function generateInserts(tableName, rows) {
    if (!rows || rows.length === 0) return `-- No data for ${tableName}\n`;

    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');

    let sql = `-- ${tableName}: ${rows.length} rows\n`;

    // For social_oauth_accounts, use the actual table name
    let actualTable = tableName;
    if (tableName === 'social_oauth_accounts_youtube_x' || tableName === 'social_oauth_accounts_meta') {
        actualTable = 'social_oauth_accounts';
    }

    // Batch inserts in groups of 50
    for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        sql += `INSERT INTO "${actualTable}" (${colList}) VALUES\n`;
        const values = batch.map(row => {
            const vals = columns.map(c => escapeSQL(row[c]));
            return `  (${vals.join(', ')})`;
        });
        sql += values.join(',\n');
        sql += `\nON CONFLICT (id) DO NOTHING;\n\n`;
    }

    return sql;
}

// Process each file
let allSQL = `-- Supabase Data Import\n-- Generated from Lovable SQL Editor exports\n-- Date: ${new Date().toISOString()}\n\n`;
const summary = [];

for (const { file, table } of fileTableMap) {
    const filePath = join(dir, file);
    console.log(`Processing ${file} -> ${table}...`);

    const rows = parseJsonAggCsv(filePath);
    if (rows) {
        summary.push(`${table}: ${rows.length} rows`);
        allSQL += generateInserts(table, rows);
    } else {
        summary.push(`${table}: FAILED TO PARSE`);
    }
}

writeFileSync('import_data.sql', allSQL, 'utf8');
writeFileSync('import_summary.txt', summary.join('\n'), 'utf8');
console.log('\nDone! Summary:');
summary.forEach(s => console.log(`  ${s}`));
console.log('\nSQL written to import_data.sql');
