import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(l => { 
  const i = l.indexOf('=');
  const k = l.substring(0, i).trim();
  const v = l.substring(i+1).trim().replace(/\"/g, '').replace(/\'/g, '').replace(/\r/g, ''); 
  env[k] = v;
});

fetch(env.VITE_SUPABASE_URL + '/functions/v1/bulk-sync-all', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(e => console.error(e));
