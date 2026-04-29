const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) acc[match[1]] = match[2].replace(/^"|"$/g, '');
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function test() {
    const fileBuf = fs.readFileSync('C:\\Users\\Iris\\Downloads\\Product data 2026-04-21 - 2026-04-28 - Campaign 1858858804552817.xlsx');
    const file = new Blob([fileBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const formData = new FormData();
    formData.append('clientId', '041555a7-1a25-42b8-89c7-edc40afff861');
    formData.append('file', file, 'Product data 2026-04-21 - 2026-04-28 - Campaign 1858858804552817.xlsx');

    const res = await supabase.functions.invoke('analyze-amazon-ads', { body: formData });
    console.log(JSON.stringify(res, null, 2));
}

test();
