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

    // Convert date range to inclusive UTC range
    const startISO = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endISO = endExclusive.toISOString();

    let items: { country: string; value: number }[] = [];

    if (metric === 'pageviews') {
      // Count page views grouped by country
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
      // Count sessions grouped by country
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
      // Distinct visitor_id, using first-seen country in range
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

      // Map each visitor to their first-seen country
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

    console.log(`Country breakdown for ${clientId}: ${metric}, ${items.length} countries`);

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
