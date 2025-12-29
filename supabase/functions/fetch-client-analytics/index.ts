import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, startDate, endDate } = await req.json();

    if (!clientId || !startDate || !endDate) {
      console.error('Missing required parameters:', { clientId, startDate, endDate });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: clientId, startDate, endDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch client details
    console.log('Fetching client:', clientId);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, supabase_url, api_key, is_active')
      .eq('id', clientId)
      .maybeSingle();

    if (clientError) {
      console.error('Error fetching client:', clientError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch client details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client) {
      console.error('Client not found:', clientId);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client.is_active) {
      console.error('Client is not active:', clientId);
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: 'Client is not active',
          errorType: 'inactive',
          clientId: client.id,
          clientName: client.name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client.supabase_url || !client.api_key) {
      console.error('Client missing analytics configuration:', clientId);
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: 'Web analytics not configured for this client',
          errorType: 'not_configured',
          clientId: client.id,
          clientName: client.name,
          details: 'This client does not have a Supabase URL or API key configured for web analytics.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the client's get-analytics endpoint
    console.log('Fetching analytics from:', client.supabase_url);
    const analyticsUrl = `${client.supabase_url}/functions/v1/get-analytics`;
    
    const analyticsResponse = await fetch(analyticsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Some client projects validate the key via headers rather than body
        'x-api-key': client.api_key,
        Authorization: `Bearer ${client.api_key}`,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        apiKey: client.api_key,
        api_key: client.api_key,
      }),
    });

    if (!analyticsResponse.ok) {
      const errorText = await analyticsResponse.text();
      console.error('Analytics endpoint error:', analyticsResponse.status, errorText);

      // Determine error type based on status code
      let errorType = 'fetch_failed';
      let errorMessage = 'Failed to fetch analytics from client';
      
      if (analyticsResponse.status === 401 || analyticsResponse.status === 403) {
        errorType = 'auth_failed';
        errorMessage = 'Authentication failed - check API key configuration';
      } else if (analyticsResponse.status === 404) {
        errorType = 'no_endpoint';
        errorMessage = 'Analytics endpoint not found on client project';
      } else if (analyticsResponse.status >= 500) {
        errorType = 'server_error';
        errorMessage = 'Client analytics server error';
      }

      // IMPORTANT: return 200 so the frontend can render a friendly error state
      return new Response(
        JSON.stringify({
          ok: false,
          error: errorMessage,
          errorType,
          details: errorText,
          status: analyticsResponse.status,
          clientId: client.id,
          clientName: client.name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analyticsData = await analyticsResponse.json();
    console.log('Analytics fetched successfully for client:', client.name);

    return new Response(
      JSON.stringify({ 
        clientId: client.id,
        clientName: client.name,
        analytics: analyticsData,
        dateRange: { startDate, endDate }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-client-analytics function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
