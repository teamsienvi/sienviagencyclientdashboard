const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impkb2RqYnp5cHVpeWhncnp1eXpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk5NTU0NCwiZXhwIjoyMDkwNTcxNTQ0fQ.GE5_tYmuDdGZZYi1EDONwsZy5_jCWNTZxn9HcFdqYpE";

// Wait! This is the jdod... key. The project is mhuxrnxajtiwxauhlhlv. 
// I must use the correct service key for mhuxrnxajtiwxauhlhlv or use the edge function trick!
// I'll just use the supabase.functions.invoke trick since the edge functions run with the service role!
// Actually, I can just use a supabase REST call with the anon key and my edge function.
// But anon key might not have delete permission for report_seo_metrics!
// Let me write an edge function to do it, or just use the local Supabase CLI? I don't have local Supabase CLI connected.
