import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = join(__dirname, '..', 'supabase', 'migrations', '20260225051200_import_small_tables.sql');

function esc(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    return `'${String(val).replace(/'/g, "''")}'`;
}

let sql = '-- Import data from Lovable (small tables)\n\n';

// 1. Social accounts
const accounts = JSON.parse(readFileSync(join(__dirname, 'social_accounts.json'), 'utf8'));
sql += '-- social_accounts (' + accounts.length + ' rows)\n';
for (const r of accounts) {
    sql += `INSERT INTO public.social_accounts (id, client_id, platform, account_id, account_name, access_token_encrypted, refresh_token_encrypted, token_expires_at, is_active, connected_at, created_at, updated_at) VALUES (${esc(r.id)}, ${esc(r.client_id)}, ${esc(r.platform)}, ${esc(r.account_id)}, ${esc(r.account_name)}, ${esc(r.access_token_encrypted)}, ${esc(r.refresh_token_encrypted)}, ${esc(r.token_expires_at)}, ${esc(r.is_active)}, ${esc(r.connected_at)}, ${esc(r.created_at)}, ${esc(r.updated_at)}) ON CONFLICT (id) DO NOTHING;\n`;
}

// 2. Social OAuth accounts
const oauth = JSON.parse(readFileSync(join(__dirname, 'social_oauth_accounts.json'), 'utf8'));
sql += '\n-- social_oauth_accounts (' + oauth.length + ' rows)\n';
for (const r of oauth) {
    sql += `INSERT INTO public.social_oauth_accounts (id, client_id, platform, access_token, refresh_token, token_expires_at, meta_user_id, page_id, instagram_business_id, is_active, connected_at, created_at, updated_at, user_access_token) VALUES (${esc(r.id)}, ${esc(r.client_id)}, ${esc(r.platform)}, ${esc(r.access_token)}, ${esc(r.refresh_token)}, ${esc(r.token_expires_at)}, ${esc(r.meta_user_id)}, ${esc(r.page_id)}, ${esc(r.instagram_business_id)}, ${esc(r.is_active)}, ${esc(r.connected_at)}, ${esc(r.created_at)}, ${esc(r.updated_at)}, ${esc(r.user_access_token)}) ON CONFLICT (id) DO NOTHING;\n`;
}

// 3. Social account demographics
const demos = JSON.parse(readFileSync(join(__dirname, 'social_account_demographics.json'), 'utf8'));
sql += '\n-- social_account_demographics (' + demos.length + ' rows)\n';
for (const r of demos) {
    sql += `INSERT INTO public.social_account_demographics (id, client_id, platform, period_start, period_end, gender_male, gender_female, gender_unknown, countries, collected_at, created_at) VALUES (${esc(r.id)}, ${esc(r.client_id)}, ${esc(r.platform)}, ${esc(r.period_start)}, ${esc(r.period_end)}, ${esc(r.gender_male)}, ${esc(r.gender_female)}, ${esc(r.gender_unknown)}, ${r.countries ? esc(r.countries) : 'NULL'}, ${esc(r.collected_at)}, ${esc(r.created_at)}) ON CONFLICT (id) DO NOTHING;\n`;
}

writeFileSync(outFile, sql);
console.log('Generated:', outFile);
console.log(`Total: ${accounts.length + oauth.length + demos.length} rows`);
