import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientUserRequest {
  email: string;
  password: string;
  clientId: string;
  clientName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { users } = await req.json() as { users: ClientUserRequest[] };
    
    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "users array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { email: string; status: string; userId?: string; error?: string }[] = [];

    for (const user of users) {
      try {
        // Create the auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true, // Auto-confirm email
        });

        if (authError) {
          // Check if user already exists
          if (authError.message.includes("already been registered")) {
            // Get existing user
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email === user.email);
            
            if (existingUser) {
              // Check if already mapped to client
              const { data: existingMapping } = await supabaseAdmin
                .from("client_users")
                .select("id")
                .eq("user_id", existingUser.id)
                .eq("client_id", user.clientId)
                .maybeSingle();

              if (!existingMapping) {
                // Add mapping
                await supabaseAdmin
                  .from("client_users")
                  .insert({ user_id: existingUser.id, client_id: user.clientId });
              }

              results.push({
                email: user.email,
                status: "exists",
                userId: existingUser.id,
              });
              continue;
            }
          }
          
          results.push({
            email: user.email,
            status: "error",
            error: authError.message,
          });
          continue;
        }

        const userId = authData.user!.id;

        // Map user to client
        const { error: mappingError } = await supabaseAdmin
          .from("client_users")
          .insert({ user_id: userId, client_id: user.clientId });

        if (mappingError) {
          results.push({
            email: user.email,
            status: "created_no_mapping",
            userId,
            error: mappingError.message,
          });
          continue;
        }

        results.push({
          email: user.email,
          status: "created",
          userId,
        });
      } catch (err) {
        results.push({
          email: user.email,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
