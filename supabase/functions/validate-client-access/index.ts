import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header", hasAccess: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { clientId } = await req.json();
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Missing clientId", hasAccess: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token to get their user ID
    const supabaseWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", hasAccess: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to check access (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (adminRole) {
      console.log(`Admin access granted for user ${user.id} to client ${clientId}`);
      return new Response(
        JSON.stringify({ hasAccess: true, isAdmin: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has explicit client access
    const { data: clientAccess } = await supabaseAdmin
      .from("client_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (clientAccess) {
      console.log(`Client access granted for user ${user.id} to client ${clientId}`);
      return new Response(
        JSON.stringify({ hasAccess: true, isAdmin: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Access denied for user ${user.id} to client ${clientId}`);
    return new Response(
      JSON.stringify({ hasAccess: false, isAdmin: false }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error validating client access:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, hasAccess: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
