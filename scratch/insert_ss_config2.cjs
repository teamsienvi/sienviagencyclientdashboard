const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
console.log('Key length:', SUPABASE_KEY ? SUPABASE_KEY.length : 'undefined');
console.log('Key start:', SUPABASE_KEY ? SUPABASE_KEY.substring(0, 15) : 'undefined');

const clientId = 'd6980a31-7b9c-48c6-a6c8-f4633d6bfa33';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const configs = [
    {
      client_id: clientId,
      platform: 'instagram',
      user_id: '4380439',
      blog_id: '5693754',
      is_active: true,
      is_business: true
    },
    {
      client_id: clientId,
      platform: 'facebook',
      user_id: '4380439',
      blog_id: '5693754',
      is_active: true,
      is_business: true
    }
  ];

  for (const config of configs) {
    const { error } = await supabase.from('client_metricool_config').upsert(config, { onConflict: 'client_id,platform' });
    if (error) {
      console.error('Failed to insert for', config.platform, error);
    } else {
      console.log('Successfully inserted config for', config.platform);
    }
  }
}

run().catch(console.error);
