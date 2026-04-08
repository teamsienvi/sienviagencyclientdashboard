import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/^"|"$/g, '');

const supabase = createClient(url, key);

async function check() {
    console.log('--- Clients ---');
    const { data: clients, error: err1 } = await supabase.from('clients').select('id, name').in('name', ['Serenity Scrolls', 'Father Figure Formula']);
    console.log(err1 || clients);

    if (clients && clients.length > 0) {
        console.log('\n--- Client SEO Config ---');
        const ids = clients.map((c: any) => c.id);
        const { data: config, error: err2 } = await supabase.from('client_seo_config').select('*').in('client_id', ids);
        console.log(err2 || config);

        console.log('\n--- SEO Metrics Count ---');
        for (const id of ids) {
            const { count } = await supabase.from('report_seo_metrics').select('*', { count: 'exact', head: true }).eq('client_id', id);
            console.log(id, 'Metrics count:', count);
        }
    }
}
check();
