import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[match[1].trim()] = val;
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = supabaseKey;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  console.log('Fetching clients with active SEO configuration...\n');
  const { data: seoConfigs, error } = await supabase
    .from('client_seo_config')
    .select('client_id, domain')
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch seo configs:', error);
    return;
  }

  for (const config of seoConfigs) {
    // Fetch the two most recent records to compare and see if "new" data exists
    const { data: metrics, error: metricsErr } = await supabase
      .from('report_seo_metrics')
      .select('collected_at, site_audit_score, tracked_keywords')
      .eq('client_id', config.client_id)
      .order('collected_at', { ascending: false })
      .limit(2);

    if (metricsErr) {
      console.error(`Error fetching metrics for ${config.domain}:`, metricsErr);
      continue;
    }

    console.log(`--- ${config.domain} ---`);
    if (!metrics || metrics.length === 0) {
      console.log('❌ No SEO data found at all.\n');
      continue;
    }

    const latest = metrics[0];
    console.log(`Latest sync: ${new Date(latest.collected_at).toLocaleString()}`);
    console.log(`Site Score: ${latest.site_audit_score || 'N/A'}`);
    console.log(`Keywords Tracked: ${latest.tracked_keywords ? latest.tracked_keywords.length : 0}`);
    
    if (metrics.length > 1) {
      const previous = metrics[1];
      console.log(`Previous sync: ${new Date(previous.collected_at).toLocaleString()}`);
      
      const scoreChanged = latest.site_audit_score !== previous.site_audit_score;
      const kwLengthChanged = (latest.tracked_keywords?.length || 0) !== (previous.tracked_keywords?.length || 0);
      
      if (scoreChanged || kwLengthChanged) {
        console.log(`✨ NEW DATA DETECTED! (Score or keyword count changed from previous)`);
      } else {
        // Compare the JSON of keywords roughly
        const latestKwStr = JSON.stringify(latest.tracked_keywords || []);
        const prevKwStr = JSON.stringify(previous.tracked_keywords || []);
        if (latestKwStr !== prevKwStr) {
           console.log(`✨ NEW DATA DETECTED! (Keyword metrics changed)`);
        } else {
           console.log(`🔄 Data looks identical to previous sync.`);
        }
      }
    } else {
      console.log(`✨ First data point! No previous sync to compare.`);
    }
    console.log('');
  }
}

run();
