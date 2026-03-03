// Transform import_08 social_follower_timeline
// Old schema: engagement_percent, engagement_tier, followers, id, influence, link, platform, reach_tier, report_id, views
// New schema: id, client_id, platform, date, followers, collected_at, created_at
// We need to map report_id → client_id + date, keep platform and followers
import { readFileSync, writeFileSync } from 'fs';

// Build report_id -> {client_id, week_start, week_end} map from import_06
const reportsSql = readFileSync('import_06_reports.sql', 'utf8');
const reportMap = {};
const reportRegex = /\('([^']+)',\s*'([^']+)',\s*'[^']*',\s*'([^']+)',\s*'[^']*',\s*'([^']+)',\s*'([^']+)'\)/g;
let match;
while ((match = reportRegex.exec(reportsSql)) !== null) {
    const [, client_id, , id, week_end, week_start] = match;
    reportMap[id] = { client_id, week_start, week_end };
}
console.log(`Loaded ${Object.keys(reportMap).length} reports`);

// Read import_08
const metricsSql = readFileSync('import_08_social_follower_timeline.sql', 'utf8');

// Parse each row: ('created_at', engagement_percent, 'engagement_tier'/NULL, followers, 'id', influence, 'link', 'platform', 'reach_tier'/NULL, 'report_id', views)
const rowRegex = /\('([^']+)',\s*([\d.]+),\s*(?:'[^']*'|NULL),\s*(\d+),\s*'([^']+)',\s*\d+,\s*'([^']*)',\s*'([^']*)',\s*(?:'[^']*'|NULL),\s*'([^']+)',\s*(\d+)\)/g;

const seen = new Set();
const rows = [];
let totalParsed = 0;
let skippedNoReport = 0;
let skippedEmpty = 0;
let skippedDupe = 0;

let m;
while ((m = rowRegex.exec(metricsSql)) !== null) {
    totalParsed++;
    const [, created_at, , followers, id, link, platform, report_id, views] = m;

    const report = reportMap[report_id];
    if (!report) {
        skippedNoReport++;
        continue;
    }

    // Skip rows with no meaningful platform
    if (!platform || platform.trim() === '') {
        skippedEmpty++;
        continue;
    }

    // Normalize platform to lowercase
    const normalizedPlatform = platform.toLowerCase();

    // Use week_start as the date
    const date = report.week_start;

    // Deduplicate by (client_id, platform, date)
    const key = `${report.client_id}|${normalizedPlatform}|${date}`;
    if (seen.has(key)) {
        skippedDupe++;
        continue;
    }
    seen.add(key);

    rows.push({
        id,
        client_id: report.client_id,
        platform: normalizedPlatform,
        date,
        followers: parseInt(followers),
        collected_at: created_at,
        created_at,
    });
}

console.log(`Parsed ${totalParsed} rows total`);
console.log(`Skipped: ${skippedNoReport} no report, ${skippedEmpty} empty platform, ${skippedDupe} duplicates`);
console.log(`Keeping ${rows.length} unique rows`);

// Generate SQL
const batchSize = 50;
let sql = `-- social_follower_timeline: ${rows.length} rows (transformed)\n`;

for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    sql += `INSERT INTO "social_follower_timeline" ("id", "client_id", "platform", "date", "followers", "collected_at", "created_at") VALUES\n`;
    sql += batch.map(r =>
        `  ('${r.id}', '${r.client_id}', '${r.platform}', '${r.date}', ${r.followers}, '${r.collected_at}', '${r.created_at}')`
    ).join(',\n');
    sql += `\nON CONFLICT (client_id, platform, date) DO NOTHING;\n\n`;
}

writeFileSync('import_08_social_follower_timeline.sql', sql, 'utf8');
console.log(`Written import_08_social_follower_timeline.sql (${Math.round(sql.length / 1024)}KB)`);
