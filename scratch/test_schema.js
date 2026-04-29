import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://mhuxrnxajtiwxauhlhlv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RqYnp5cHVpeWhncnp1eXpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5NTU0NCwiZXhwIjoyMDkwNTcxNTQ0fQ.GE5_tYmuDdGZZYi1EDONwsZy5_jCWNTZxn9HcFdqYpE"
);

async function check() {
  const { data, error } = await supabase.from('report_seo_metrics').select('*').limit(1);
  if (error) {
     console.error("Error:", error);
  } else {
     console.log("Columns:", data && data.length > 0 ? Object.keys(data[0]) : "No data");
  }
}
check();
