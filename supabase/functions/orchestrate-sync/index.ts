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

        const { clientId, platform, module, forceRetry } = await req.json();

        if (!clientId || !platform || !module) {
            throw new Error("clientId, platform, and module are required");
        }

        console.log(`[orchestrate-sync] Started for ${clientId} - ${platform}/${module}`);

        // 1. Fetch current sync state
        const { data: state, error: stateError } = await supabase
            .from("sync_state_registry")
            .select("*")
            .eq("client_id", clientId)
            .eq("platform", platform)
            .eq("module", module)
            .maybeSingle();

        if (stateError) throw stateError;

        const now = new Date();
        const isLocked = state?.status === 'syncing' && state?.job_locked_until && new Date(state.job_locked_until) > now;
        
        // Idempotency: Skip if already safely locked
        if (isLocked && !forceRetry) {
            console.log(`[orchestrate-sync] SKIPPED: Job already running for ${platform}/${module}. Locked until ${state.job_locked_until}`);
            return new Response(JSON.stringify({ status: 'skipped', reason: 'locked' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Retry Backoff Logic
        if (state?.status === 'failed' && state?.retry_count >= 3 && !forceRetry) {
            console.log(`[orchestrate-sync] SKIPPED: Max retries (3) reached for ${platform}/${module}. User must manually retry.`);
            return new Response(JSON.stringify({ status: 'skipped', reason: 'max_retries' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (state?.status === 'failed' && state?.next_retry_at && new Date(state.next_retry_at) > now && !forceRetry) {
            console.log(`[orchestrate-sync] SKIPPED: In retry cooldown until ${state.next_retry_at}`);
            return new Response(JSON.stringify({ status: 'skipped', reason: 'cooldown' }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // 2. Determine Lock Duration based on job type
        let lockMinutes = 5; // Standard sync
        let workerFn = "";
        let workerPayload: any = { clientId };

        if (module === 'social_summary') {
            lockMinutes = 10;
            workerFn = "generate-analytics-summary";
            workerPayload = { clientId, type: "social" };
        } else if (module === 'website_summary') {
            lockMinutes = 10;
            workerFn = "generate-analytics-summary";
            workerPayload = { clientId, type: "website" };
        } else if ((module === 'metricool' && platform !== 'ads') || platform === 'tiktok' || platform === 'linkedin') {
            lockMinutes = 5;
            workerFn = "sync-metricool";
            // sync-metricool requires platform to look up the correct Metricool config
            workerPayload = { clientId, platform };
        } else if (module === 'meta' || platform === 'instagram' || platform === 'facebook') {
            lockMinutes = 5;
            workerFn = "sync-meta";
            workerPayload = { clientId };
        } else if (platform === 'x') {
            lockMinutes = 5;
            // Check if client has Metricool config for X — if so, use sync-metricool
            // (e.g. Father Figure Formula syncs X via Metricool, not direct API)
            const { data: xMetricoolConfig } = await supabase
                .from("client_metricool_config")
                .select("id")
                .eq("client_id", clientId)
                .eq("platform", "x")
                .eq("is_active", true)
                .maybeSingle();

            if (xMetricoolConfig) {
                workerFn = "sync-metricool";
                workerPayload = { clientId, platform: "x" };
                console.log(`[orchestrate-sync] X has Metricool config — routing to sync-metricool`);
            } else {
                workerFn = "sync-x";
                workerPayload = { clientId };
                console.log(`[orchestrate-sync] X has no Metricool config — routing to sync-x (CSV/OAuth)`);
            }
        } else if (platform === 'youtube') {
            lockMinutes = 5;
            workerFn = "sync-youtube";
            // sync-youtube will self-resolve channelHandle from client_metricool_config
            workerPayload = { clientId, resolveFromConfig: true };
        } else if (platform === 'ads' && module === 'metricool') {
            lockMinutes = 5;
            workerFn = "metricool-ads";
            workerPayload = { clientId, endpoint: "sync" };
        } else if (platform === 'shopify') {
            lockMinutes = 5;
            workerFn = "shopify-analytics";
            workerPayload = { clientId, endpoint: "sync" };
        } else if (platform === 'lms') {
            lockMinutes = 5;
            workerFn = "sync-lms";
            workerPayload = { clientId };
        } else if (platform === 'seo') {
            lockMinutes = 5;
            workerFn = "sync-ubersuggest";
            workerPayload = { clientId };
        } else {
            console.log(`[orchestrate-sync] WARNING: Unknown module routing for ${platform}/${module}`);
            return new Response(JSON.stringify({ status: 'error', error: 'Unknown routing' }), { status: 400, headers: corsHeaders });
        }

        const lockedUntil = new Date(now.getTime() + lockMinutes * 60000);

        // 3. Acquire Lock (Upsert)
        const { error: lockError } = await supabase
            .from("sync_state_registry")
            .upsert({
                client_id: clientId,
                platform,
                module,
                status: 'syncing',
                job_locked_until: lockedUntil.toISOString()
            }, { onConflict: "client_id,platform,module" });

        if (lockError) throw lockError;
        console.log(`[orchestrate-sync] LOCKED for ${lockMinutes}m: Invoking ${workerFn}`);

        // 4. Dispatch Async
        const bgTask = supabase.functions.invoke(workerFn, { body: workerPayload })
            .then(async ({ error }) => {
                if (error) {
                    console.error(`[orchestrate-sync] Worker ${workerFn} failed:`, error);
                    await markFailed(supabase, clientId, platform, module, error.message, state?.retry_count || 0);
                } else {
                    console.log(`[orchestrate-sync] Worker ${workerFn} completed successfully.`);
                    await markSuccess(supabase, clientId, platform, module);
                }
            })
            .catch(async (err) => {
                console.error(`[orchestrate-sync] Worker invocation failed:`, err);
                await markFailed(supabase, clientId, platform, module, err.message, state?.retry_count || 0);
            });
            
        if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
            (globalThis as any).EdgeRuntime.waitUntil(bgTask);
        } else {
            // Fallback for local testing or older runtimes
            bgTask.catch(() => {});
        }

        return new Response(JSON.stringify({ status: 'dispatched', workerFn, lockedUntil }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error in orchestrate-sync:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function markSuccess(supabase: any, clientId: string, platform: string, module: string) {
    const now = new Date();
    // Default TTL: 12 hours for most, 24 for summaries
    const ttlHours = module.includes('summary') ? 24 : 12;
    const staleAfter = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await supabase.from("sync_state_registry").update({
        status: 'ready',
        job_locked_until: null,
        last_synced_at: now.toISOString(),
        last_success_at: now.toISOString(),
        stale_after_at: staleAfter.toISOString(),
        retry_count: 0,
        error_message: null
    }).match({ client_id: clientId, platform, module });
}

async function markFailed(supabase: any, clientId: string, platform: string, module: string, errorMessage: string, currentRetries: number) {
    const now = new Date();
    const newCount = currentRetries + 1;
    
    // Cooldown: 5m, 15m, 60m
    let cooldownMinutes = 60;
    if (newCount === 1) cooldownMinutes = 5;
    else if (newCount === 2) cooldownMinutes = 15;

    const nextRetry = new Date(now.getTime() + cooldownMinutes * 60000);

    await supabase.from("sync_state_registry").update({
        status: 'failed',
        job_locked_until: null,
        last_failed_at: now.toISOString(),
        next_retry_at: nextRetry.toISOString(),
        retry_count: newCount,
        error_message: errorMessage
    }).match({ client_id: clientId, platform, module });
}
