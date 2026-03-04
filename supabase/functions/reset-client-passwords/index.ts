import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { updates } = await req.json() as {
            updates: { email: string; newPassword: string }[];
        };

        if (!updates || !Array.isArray(updates)) {
            return new Response(
                JSON.stringify({ error: "updates array is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Look up all users
        const { data: allUsersData } = await supabaseAdmin.auth.admin.listUsers();
        const allUsers = allUsersData?.users || [];

        const results: { email: string; status: string; error?: string }[] = [];

        for (const update of updates) {
            const user = allUsers.find((u) => u.email === update.email);
            if (!user) {
                results.push({ email: update.email, status: "not_found" });
                continue;
            }

            const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                password: update.newPassword,
            });

            if (error) {
                results.push({ email: update.email, status: "error", error: error.message });
            } else {
                results.push({ email: update.email, status: "updated" });
            }
        }

        return new Response(
            JSON.stringify({ results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
