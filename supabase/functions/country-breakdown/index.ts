import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, startDate, endDate, metric = 'pageviews' } = await req.json();

    if (!clientId || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: clientId, startDate, endDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch client config to check for external Supabase project
    const { data: client } = await supabase
      .from('clients')
      .select('supabase_url, api_key')
      .eq('id', clientId)
      .maybeSingle();

    // Convert date range to inclusive UTC range
    const startISO = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endISO = endExclusive.toISOString();

    let items: { country: string; value: number }[] = [];

    // Helper: try fetching from external project REST API
    const fetchExternalCountries = async (): Promise<{ country: string; value: number }[] | null> => {
      if (!client?.supabase_url || !client?.api_key) return null;

      console.log('Trying external project for country data:', client.supabase_url);

      // Try sessions table first (most reliable for country), then page views
      const tables = [
        { name: 'analytics_sessions', dateCol: 'started_at' },
        { name: 'web_analytics_sessions', dateCol: 'started_at' },
        { name: 'analytics_page_views', dateCol: 'viewed_at' },
        { name: 'web_analytics_page_views', dateCol: 'viewed_at' },
        { name: 'analytics_events', dateCol: 'created_at' },
      ];

      for (const table of tables) {
        try {
          const url = `${client.supabase_url}/rest/v1/${table.name}?select=country&${table.dateCol}=gte.${startDate}&${table.dateCol}=lt.${endDate}&limit=2000`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(url, {
            headers: {
              'apikey': client.api_key,
              'Authorization': `Bearer ${client.api_key}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (resp.ok) {
            const rows = await resp.json();
            if (Array.isArray(rows) && rows.length > 0) {
              const counts: Record<string, number> = {};
              rows.forEach((row: any) => {
                let c = (row.country || 'Unknown').trim();
                // Normalize: if it's a 2-letter code, uppercase it; otherwise map common names
                if (c.length === 2) c = c.toUpperCase();
                else if (c === 'Unknown' || !c) c = 'XX';
                counts[c] = (counts[c] || 0) + 1;
              });
              const result = Object.entries(counts)
                .map(([country, value]) => ({ country, value }))
                .sort((a, b) => b.value - a.value);
              console.log(`External country data from ${table.name}: ${result.length} countries, ${rows.length} rows`);
              return result;
            }
          }
        } catch (e) {
          console.log(`External ${table.name} error: ${e instanceof Error ? e.message : e}`);
        }
      }
      return null;
    };

    // Try external project first
    const externalItems = await fetchExternalCountries();
    if (externalItems && externalItems.length > 0) {
      items = externalItems;
      console.log(`Country breakdown from external for ${clientId}: ${items.length} countries`);
    } else {
      // Fall back to local tables
      if (metric === 'pageviews') {
        const { data, error } = await supabase
          .from('web_analytics_page_views')
          .select('country')
          .eq('client_id', clientId)
          .gte('viewed_at', startISO)
          .lt('viewed_at', endISO);

        if (error) {
          console.error('Error fetching page views:', error);
          throw error;
        }

        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const c = row.country || 'XX';
          counts[c] = (counts[c] || 0) + 1;
        });

        items = Object.entries(counts)
          .map(([country, value]) => ({ country, value }))
          .sort((a, b) => b.value - a.value);

      } else if (metric === 'sessions') {
        const { data, error } = await supabase
          .from('web_analytics_sessions')
          .select('country')
          .eq('client_id', clientId)
          .gte('started_at', startISO)
          .lt('started_at', endISO);

        if (error) {
          console.error('Error fetching sessions:', error);
          throw error;
        }

        const counts: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const c = row.country || 'XX';
          counts[c] = (counts[c] || 0) + 1;
        });

        items = Object.entries(counts)
          .map(([country, value]) => ({ country, value }))
          .sort((a, b) => b.value - a.value);

      } else if (metric === 'visitors') {
        const { data, error } = await supabase
          .from('web_analytics_page_views')
          .select('visitor_id, country, viewed_at')
          .eq('client_id', clientId)
          .gte('viewed_at', startISO)
          .lt('viewed_at', endISO)
          .order('viewed_at', { ascending: true });

        if (error) {
          console.error('Error fetching visitors:', error);
          throw error;
        }

        const visitorCountry: Record<string, string> = {};
        (data || []).forEach((row: any) => {
          if (!visitorCountry[row.visitor_id]) {
            visitorCountry[row.visitor_id] = row.country || 'XX';
          }
        });

        const counts: Record<string, number> = {};
        Object.values(visitorCountry).forEach((c) => {
          counts[c] = (counts[c] || 0) + 1;
        });

        items = Object.entries(counts)
          .map(([country, value]) => ({ country, value }))
          .sort((a, b) => b.value - a.value);

      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid metric. Use: pageviews, sessions, or visitors' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Country breakdown from local for ${clientId}: ${metric}, ${items.length} countries`);
    }

    return new Response(
      JSON.stringify({
        metric,
        from: startDate,
        to: endDate,
        scope: { client_id: clientId },
        items,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in country-breakdown:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
