import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const playiqId = '22090989-2d0e-47b2-b9c5-98652d7f0957';
  
  const { data: posts, error } = await supabase
    .from("social_content")
    .select("platform, title, url")
    .eq("client_id", playiqId)
    .eq("platform", "facebook")
    .order("published_at", { ascending: false })
    .limit(3);
    
  console.log("PlayIQ FB Posts:", JSON.stringify(posts, null, 2), error);
}
run();
