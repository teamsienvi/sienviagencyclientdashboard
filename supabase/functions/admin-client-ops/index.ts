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

        const { action, clientName, clientId, userId, blogId, platform, logoUrl } = await req.json();

        if (action === "create_client") {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .insert({ name: clientName, is_active: true })
                .select("id, name")
                .single();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ client: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "map_client_user") {
            const { error } = await supabaseAdmin
                .from("client_users")
                .insert({ user_id: userId, client_id: clientId });
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "list_clients") {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .select("id, name")
                .order("name");
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ clients: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "upsert_metricool_config") {
            const platforms = platform ? [platform] : ["instagram", "facebook", "tiktok", "youtube", "meta_ads", "google_ads", "tiktok_ads"];
            const results = [];
            for (const p of platforms) {
                const { data, error } = await supabaseAdmin
                    .from("client_metricool_config")
                    .upsert(
                        { client_id: clientId, user_id: userId, blog_id: blogId, platform: p, is_active: true },
                        { onConflict: "client_id,platform" }
                    )
                    .select("id, client_id, platform, blog_id")
                    .single();
                if (error) {
                    results.push({ platform: p, error: error.message });
                } else {
                    results.push({ platform: p, config: data });
                }
            }
            return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "insert_metricool_config") {
            const { data, error } = await supabaseAdmin
                .from("client_metricool_config")
                .insert({ client_id: clientId, user_id: userId, blog_id: blogId, platform, is_active: true })
                .select("id, client_id, platform, blog_id")
                .single();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ config: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "delete_metricool_config") {
            const { error, count } = await supabaseAdmin
                .from("client_metricool_config")
                .delete({ count: "exact" })
                .eq("client_id", clientId)
                .eq("platform", platform);
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ success: true, deleted: count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "update_client_name") {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .update({ name: clientName })
                .eq("id", clientId)
                .select("id, name")
                .single();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ client: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "create_storage_bucket") {
            const { data, error } = await supabaseAdmin.storage.createBucket("client-logos", { public: true });
            if (error && !error.message?.includes("already exists")) {
                return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ success: true, bucket: "client-logos" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "upload_logo") {
            const { fileName, fileBase64, contentType } = await req.json().catch(() => ({}));
            if (!fileName || !fileBase64) {
                return new Response(JSON.stringify({ error: "fileName and fileBase64 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
            const { data, error } = await supabaseAdmin.storage
                .from("client-logos")
                .upload(fileName, bytes, { contentType: contentType || "image/jpeg", upsert: true });
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            const { data: urlData } = supabaseAdmin.storage.from("client-logos").getPublicUrl(fileName);
            return new Response(JSON.stringify({ url: urlData.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "update_client_logo") {
            const { data, error } = await supabaseAdmin
                .from("clients")
                .update({ logo_url: logoUrl })
                .eq("id", clientId)
                .select("id, name, logo_url")
                .single();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ client: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "resync_meta") {
            // --- Strict JWT + admin role verification ---
            const authHeader = req.headers.get("authorization");
            if (!authHeader) {
                return new Response(JSON.stringify({ error: "Authorization required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) {
                return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
            if (roleData?.role !== "admin") {
                return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // --- Parse params ---
            const body = await req.json().catch(() => ({}));
            const periodStart = body.periodStart || new Date(Date.now() - 7 * 24*60*60*1000).toISOString().split("T")[0];
            const periodEnd = body.periodEnd || new Date().toISOString().split("T")[0];
            const platforms: string[] = body.platforms || ["instagram", "facebook"];

            // --- Async backfill: chunk large ranges into ≤ 7-day windows ---
            const start = new Date(periodStart);
            const end = new Date(periodEnd);
            const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000*60*60*24));
            const chunkSize = 7; // max days per sync call
            const chunks: { periodStart: string; periodEnd: string }[] = [];

            if (diffDays <= chunkSize) {
                chunks.push({ periodStart, periodEnd });
            } else {
                let cur = new Date(start);
                while (cur < end) {
                    const chunkEnd = new Date(Math.min(cur.getTime() + (chunkSize - 1) * 24*60*60*1000, end.getTime()));
                    chunks.push({
                        periodStart: cur.toISOString().split("T")[0],
                        periodEnd: chunkEnd.toISOString().split("T")[0],
                    });
                    cur = new Date(chunkEnd.getTime() + 24*60*60*1000);
                }
            }

            // Fire each chunk as a separate sync call (async — don't await all at once for large backfills)
            const results: any[] = [];
            for (const chunk of chunks) {
                for (const p of platforms) {
                    const fn = p === "instagram" ? "sync-metricool-instagram" : "sync-metricool-facebook";
                    try {
                        const { data, error } = await supabaseAdmin.functions.invoke(fn, {
                            body: { clientId, periodStart: chunk.periodStart, periodEnd: chunk.periodEnd },
                        });
                        results.push({ platform: p, chunk, success: !error, data: data?.diagnostics || data, error: error?.message });
                    } catch (e: any) {
                        results.push({ platform: p, chunk, success: false, error: e.message });
                    }
                }
            }

            return new Response(JSON.stringify({ success: true, chunksProcessed: chunks.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
