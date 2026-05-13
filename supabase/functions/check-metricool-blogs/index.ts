import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metricoolToken = Deno.env.get("METRICOOL_USER_TOKEN");
    
    if (!metricoolToken) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 500, headers: corsHeaders });
    }
    
    // Using simpleProfiles endpoint
    const res = await fetch("https://app.metricool.com/api/admin/simpleProfiles?userId=4380439", {
      headers: {
        "X-Mc-Auth": metricoolToken,
        "Content-Type": "application/json",
      }
    });
    
    if (!res.ok) {
      return new Response(JSON.stringify({ error: await res.text() }), { status: res.status, headers: corsHeaders });
    }
    
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: corsHeaders });
    
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
