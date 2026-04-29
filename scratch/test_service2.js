import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://mhuxrnxajtiwxauhlhlv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E"
);

async function run() {
  const clientId = '79099b9d-0281-4a95-8076-dcff0fd128a4'; // blingybag
  console.log('Invoking sync-ubersuggest for client', clientId);
  const { data, error } = await supabase.functions.invoke('sync-ubersuggest', {
    body: { clientId }
  });
  console.log('Result:', JSON.stringify(data, null, 2));
}
run();
