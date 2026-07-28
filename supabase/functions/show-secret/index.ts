import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  return new Response(JSON.stringify({
    token: Deno.env.get("METRICOOL_USER_TOKEN") || Deno.env.get("METRICOOL_AUTH") || "not_found"
  }), {
    headers: { "Content-Type": "application/json" }
  });
});
