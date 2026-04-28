import { serve } from "https://esm.sh/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        // 1. Check how many rows exist in analytics_summaries
        const { data: rows, error: rowErr } = await supabase
            .from("analytics_summaries" as any)
            .select("client_id, type, generated_at")
            .limit(20);

        // 2. Apply RLS policy: authenticated users can read analytics_summaries for any client
        //    (agency dashboard — all logged-in staff can see all clients)
        const policySQL = `
            DO $$
            BEGIN
                -- Enable RLS if not already
                ALTER TABLE IF EXISTS analytics_summaries ENABLE ROW LEVEL SECURITY;

                -- Drop existing policies to avoid conflicts
                DROP POLICY IF EXISTS "Authenticated users can read analytics_summaries" ON analytics_summaries;
                DROP POLICY IF EXISTS "Service role bypass on analytics_summaries" ON analytics_summaries;

                -- Allow all authenticated users to read (agency internal dashboard)
                CREATE POLICY "Authenticated users can read analytics_summaries"
                ON analytics_summaries FOR SELECT
                TO authenticated
                USING (true);

                -- Allow service role full access (for edge functions writing data)
                CREATE POLICY "Service role full access analytics_summaries"
                ON analytics_summaries FOR ALL
                TO service_role
                USING (true)
                WITH CHECK (true);
            END $$;
        `;

        const { data: policyResult, error: policyErr } = await supabase.rpc("exec_sql" as any, { sql: policySQL });

        return new Response(JSON.stringify({
            rows_found: rows?.length ?? 0,
            rows: rows?.slice(0, 5) ?? [],
            row_error: rowErr?.message ?? null,
            policy_error: policyErr?.message ?? "Policy applied (or exec_sql not available)",
            policy_result: policyResult ?? null,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
