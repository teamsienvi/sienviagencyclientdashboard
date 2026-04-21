import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Missing required param: clientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load the app-level auth token
    const { data: tokenCred } = await supabase
      .from("integration_credentials")
      .select("token")
      .eq("service_name", "ubersuggest_token")
      .single();

    // 2. Load the user session JWT (id cookie)
    const { data: sessionCred } = await supabase
      .from("integration_credentials")
      .select("token, updated_at")
      .eq("service_name", "ubersuggest_session")
      .single();

    if (!tokenCred?.token || !sessionCred?.token) {
      return new Response(
        JSON.stringify({ error: "Ubersuggest credentials not found. Run the GitHub Actions 'Refresh Ubersuggest Token' workflow." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeaders = {
      Authorization: tokenCred.token,
      Cookie: `id=${sessionCred.token}`,
      Accept: "application/json",
      ts: String(Math.floor(Date.now() / 1000)),
    };
    console.log(`Credentials loaded. Session updated: ${sessionCred.updated_at}`);

    // 2. Load SEO config for the client
    const { data: config, error: configError } = await supabase
      .from("client_seo_config")
      .select("domain")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (configError || !config?.domain) {
      return new Response(
        JSON.stringify({ error: `No active SEO config found for client ${clientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const targetDomain = config.domain;
    const normalize = (d: string) => d?.replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
    const normalizedTarget = normalize(targetDomain);

    // 3. Fetch projects using stored cookie
    const projectsRes = await fetch("https://app.neilpatel.com/api/projects", {
      headers: authHeaders,
    });

    if (!projectsRes.ok) {
      throw new Error(`Ubersuggest /api/projects returned ${projectsRes.status} — cookie may be expired. Update UBERSUGGEST_COOKIE in GitHub Secrets.`);
    }

    const projectsRaw = await projectsRes.json();
    const projectsArray: any[] = Array.isArray(projectsRaw)
      ? projectsRaw
      : projectsRaw.projects || projectsRaw.data || projectsRaw.result || [];

    console.log(`Found ${projectsArray.length} project(s): ${projectsArray.map((p: any) => p.domain || p.url || p.name).join(", ")}`);

    const activeProject = projectsArray.find(
      (p: any) =>
        normalize(p.domain) === normalizedTarget ||
        normalize(p.url) === normalizedTarget ||
        normalize(p.name) === normalizedTarget
    );

    if (!activeProject) {
      const tracked = projectsArray.map((p: any) => p.domain || p.url || p.name).join(", ");
      throw new Error(`Domain ${targetDomain} not found in Ubersuggest projects. Tracked: ${tracked || "(none)"}`);
    }

    const projectId = activeProject.id;
    console.log(`Resolved ${targetDomain} → projectId ${projectId}`);

    // 4. Fetch alerts
    const alertsRes = await fetch("https://app.neilpatel.com/api/user/alerts", {
      headers: authHeaders,
    });

    if (!alertsRes.ok) {
      console.warn(`Alerts API returned ${alertsRes.status} — proceeding without alert data`);
    }

    // Parse alerts once (calling .json() twice causes "Body already consumed" error)
    const allAlertsData: any[] = alertsRes.ok ? await alertsRes.json() : [];
    const projectAlerts = Array.isArray(allAlertsData)
      ? allAlertsData.filter((a: any) => a.projectId === projectId || a.project_id === projectId)
      : [];

    // Extract metrics
    const siteAudits = projectAlerts.filter((a: any) => a.alertType === "site_audit" || a.alert_type === "site_audit");
    const latestAudit = siteAudits[0] ?? null;
    const siteAuditScore = latestAudit?.content?.score?.new ?? activeProject.score ?? null;

    const positionTrackings = projectAlerts.filter(
      (a: any) => a.alertType === "position_tracking" || a.alert_type === "position_tracking"
    );
    const trackedKeywords = positionTrackings[0]?.content?.keywords || [];

    console.log(`Metrics: score=${siteAuditScore}, keywords=${trackedKeywords.length}`);

    // 5. Insert into report_seo_metrics
    const { error: insertError } = await supabase.from("report_seo_metrics").insert({
      client_id: clientId,
      site_audit_score: siteAuditScore,
      site_audit_issues: latestAudit?.content?.issues ?? null,
      tracked_keywords: trackedKeywords,
      collected_at: new Date().toISOString(),
    });

    if (insertError) throw new Error(`Failed to insert SEO metrics: ${insertError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "SEO data synced",
        data: { domain: targetDomain, siteAuditScore, trackedKeywordsCount: trackedKeywords.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Edge function error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
