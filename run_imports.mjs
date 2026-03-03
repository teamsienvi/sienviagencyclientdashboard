import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const { Client } = pg;

// Use Supabase connection pooler (session mode, port 5432) with IPv4
const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.mhuxrnxajtiwxauhlhlv',
    password: 'pifdQYFeNaT27Vjp',
    ssl: { rejectUnauthorized: false },
});

// SQL files in dependency order
const files = [
    'import_01_shopify_oauth_connections.sql',
    'import_03_social_oauth_accounts_youtube_x.sql',
    'import_04_social_oauth_accounts_meta.sql',
    'import_06_reports.sql',
    'import_05_social_account_demographics.sql',
    'import_07_social_account_metrics.sql',
    'import_08_social_follower_timeline.sql',
    'import_09_social_content.sql',
];

async function main() {
    console.log('Connecting to Supabase database via pooler...');
    await client.connect();
    console.log('Connected!\n');

    for (const file of files) {
        const filePath = resolve(file);
        if (!existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            continue;
        }

        const sql = readFileSync(filePath, 'utf8');
        const sizeKB = Math.round(sql.length / 1024);
        console.log(`Importing ${file} (${sizeKB}KB)...`);

        try {
            const result = await client.query(sql);
            if (Array.isArray(result)) {
                const totalRows = result.reduce((sum, r) => sum + (r.rowCount || 0), 0);
                console.log(`  ✓ Success (${result.length} statements, ${totalRows} rows affected)`);
            } else {
                console.log(`  ✓ Success (${result.rowCount || 0} rows affected)`);
            }
        } catch (error) {
            console.error(`  ✗ Failed: ${error.message}`);
        }
    }

    await client.end();
    console.log('\nDone! All imports complete.');
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    client.end();
    process.exit(1);
});
