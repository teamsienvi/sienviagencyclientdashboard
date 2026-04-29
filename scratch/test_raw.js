import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://mhuxrnxajtiwxauhlhlv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E"
);

async function check() {
  const { data, error } = await supabase
    .from('report_seo_metrics')
    .select('client_id, site_audit_issues')
    .order('collected_at', { ascending: false })
    .limit(6);

  if (error) {
     console.error("Error:", error);
     return;
  }
  
  for (const row of data) {
    const iss = typeof row.site_audit_issues === 'string' ? JSON.parse(row.site_audit_issues) : row.site_audit_issues;
    console.log(`Client ${row.client_id}: keys = ${Object.keys(iss || {})}`);
    console.log(`  Highest impact length:`, iss?.highest_impact?.length);
  }
}
check();
