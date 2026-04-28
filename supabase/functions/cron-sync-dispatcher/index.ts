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
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log(`[cron-sync-dispatcher] Starting automated sync sweep...`);

        // Get stale + unlocked + retry-eligible modules for ACTIVE clients
        // 1. Unlocked (job_locked_until is null or past)
        // 2. Either ready and stale_after_at < now OR failed and next_retry_at < now
        // 3. Client must be active
        const now = new Date().toISOString();

        // Query builder using inner join to filter for active clients
        const { data: eligibleModules, error } = await supabase
            .from("sync_state_registry")
            .select(`
                client_id, 
                platform, 
                module, 
                status,
                clients!inner(is_active)
            `)
            .eq("clients.is_active", true)
            .or(`job_locked_until.is.null,job_locked_until.lt.${now}`)
            .or(`and(status.eq.ready,or(stale_after_at.lt.${now},stale_after_at.is.null)),and(status.eq.failed,next_retry_at.lt.${now})`)
            .limit(15); // Small conservative batch size as requested

        if (error) {
            throw error;
        }

        console.log(`[cron-sync-dispatcher] Found ${eligibleModules?.length || 0} eligible modules.`);

        const dispatched = [];
        const failed = [];

        // Dispatch orchestrate-sync sequentially to avoid overwhelming
        for (const mod of eligibleModules || []) {
            console.log(`[cron-sync-dispatcher] Dispatching ${mod.client_id} - ${mod.platform}/${mod.module}`);
            try {
                const { error: invokeErr } = await supabase.functions.invoke('orchestrate-sync', {
                    body: { 
                        clientId: mod.client_id, 
                        platform: mod.platform, 
                        module: mod.module 
                    }
                });

                if (invokeErr) {
                    console.error(`[cron-sync-dispatcher] Failed to dispatch ${mod.platform}/${mod.module}:`, invokeErr.message);
                    failed.push({ ...mod, error: invokeErr.message });
                } else {
                    dispatched.push(mod);
                }
                
                // Small delay between dispatches to prevent rate limiting
                await new Promise(r => setTimeout(r, 200));
            } catch (err: any) {
                console.error(`[cron-sync-dispatcher] Error dispatching ${mod.platform}/${mod.module}:`, err.message);
                failed.push({ ...mod, error: err.message });
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            dispatched: dispatched.length,
            failed: failed.length,
            details: { dispatched, failed }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("[cron-sync-dispatcher] Critical Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
