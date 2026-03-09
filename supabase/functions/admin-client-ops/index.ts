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

        if (action === "insert_metricool_config") {
            const { data, error } = await supabaseAdmin
                .from("client_metricool_config")
                .insert({ client_id: clientId, user_id: userId, blog_id: blogId, platform, is_active: true })
                .select("id, client_id, platform, blog_id")
                .single();
            if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            return new Response(JSON.stringify({ config: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

        return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
