const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0) {
    const k = line.substring(0, eqIdx).trim();
    const v = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  }
});

const token = env['METRICOOL_USER_TOKEN'];

async function main() {
  const res = await fetch('https://app.metricool.com/api/admin/simpleProfiles?userId=4380439', {
    headers: {
      'X-Mc-Auth': token,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.ok) {
    console.error("Failed to fetch blogs:", await res.text());
    return;
  }
  
  const blogs = await res.json();
  blogs.forEach(b => {
    console.log(`Blog ID: ${b.blogId}, Name: ${b.blogName}, Platform: ${b.network}`);
  });
}

main().catch(console.error);
