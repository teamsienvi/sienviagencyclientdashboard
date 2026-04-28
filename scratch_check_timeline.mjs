import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(l => { 
  const parts = l.split('='); 
  if(parts[0] && parts.length > 1) {
    const k = parts[0].trim();
    parts.shift();
    env[k] = parts.join('=').trim().replace(/\"/g, '').replace(/\'/g, ''); 
  }
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
supabase.from('social_follower_timeline').select('client_id, platform, date, followers').limit(5).then(res => console.log('DATA:', res.data, 'ERROR:', res.error));
