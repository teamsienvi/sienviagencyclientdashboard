import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(l => { 
  const i = l.indexOf('=');
  const k = l.substring(0, i).trim();
  const v = l.substring(i+1).trim().replace(/\"/g, '').replace(/\'/g, '').replace(/\r/g, ''); 
  env[k] = v;
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function testIt() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'teamsienvi@gmail.com',
    password: '9SwvfoTIo'
  });
  if (authErr) { console.log('AUTH ERROR:', authErr); return; }
  
  const { data: clients } = await supabase.from('clients').select('id, name');
  
  for (const client of clients) {
    const { data: timeline } = await supabase.from('social_follower_timeline').select('platform, date, followers').eq('client_id', client.id);
    console.log(client.name, 'TIMELINE ROWS:', timeline ? timeline.length : 0);
  }
}
testIt();
