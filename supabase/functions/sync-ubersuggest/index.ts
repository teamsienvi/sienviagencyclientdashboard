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

    // 1. Load cached projects data (intercepted by Playwright during dashboard navigation)
    const { data: projectsCache } = await supabase
      .from("integration_credentials")
      .select("token, updated_at")
      .eq("service_name", "ubersuggest_projects")
      .single();

    if (!projectsCache?.token) {
      return new Response(
        JSON.stringify({ error: "No Ubersuggest project cache found. Run the GitHub Actions 'Refresh Ubersuggest Token' workflow first." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Load cached alerts data
    const { data: alertsCache } = await supabase
      .from("integration_credentials")
      .select("token")
      .eq("service_name", "ubersuggest_alerts")
      .single();

    // 3. Parse cached data
    let projectsArray: any[] = [];
    try {
      const parsed = JSON.parse(projectsCache.token);
      projectsArray = Array.isArray(parsed)
        ? parsed
        : parsed.projects || parsed.data || parsed.result || [];
    } catch (_e) {
      throw new Error("Failed to parse cached projects data.");
    }

    console.log(`Loaded ${projectsArray.length} projects from cache. Updated: ${projectsCache.updated_at}`);
    console.log(`Project domains: ${projectsArray.map((p: any) => p.domain || p.url || p.name).join(", ")}`);

    // 4. Load SEO config for the client
    const { data: config, error: configError } = await supabase
      .from("client_seo_config")
      .select("domain")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (configError || !config?.domain) {
      return new Response(
        JSON.stringify({ error: `No active SEO config mapped for client ${clientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const targetDomain = config.domain;

    // 5. Find the project for this client's domain (flexible matching)
    const normalize = (d: string) => d?.replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
    const normalizedTarget = normalize(targetDomain);
    const activeProject = projectsArray.find(
      (p: any) =>
        normalize(p.domain) === normalizedTarget ||
        normalize(p.url) === normalizedTarget ||
        normalize(p.name) === normalizedTarget
    );

    if (!activeProject) {
      const tracked = projectsArray.map((p: any) => p.domain || p.url || p.name).join(", ");
      throw new Error(`Domain ${targetDomain} not found in cached projects. Available: ${tracked || "(none)"}`);
    }
    const projectId = activeProject.id;
    console.log(`Resolved domain ${targetDomain} → projectId ${projectId}`);

    // 6. Parse alerts from cache
    let allAlerts: any[] = [];
    if (alertsCache?.token) {
      try {
        const parsed = JSON.parse(alertsCache.token);
        allAlerts = Array.isArray(parsed) ? parsed : parsed.alerts || parsed.data || [];
      } catch (_e) {
        console.warn("Could not parse alerts cache — proceeding with empty alerts.");
      }
    }

    // Filter alerts for our specific project
    const projectAlerts = allAlerts.filter((a: any) => a.projectId === projectId || a.project_id === projectId);

    // Extract newest site audit score
    const siteAudits = projectAlerts.filter((a: any) => a.alertType === "site_audit" || a.alert_type === "site_audit");
    const latestAudit = siteAudits.length > 0 ? siteAudits[0] : null;
    const siteAuditScore = latestAudit?.content?.score?.new ?? activeProject.score ?? null;

    // Extract keyword position tracking
    const positionTrackings = projectAlerts.filter(
      (a: any) => a.alertType === "position_tracking" || a.alert_type === "position_tracking"
    );
    const latestTracking = positionTrackings.length > 0 ? positionTrackings[0] : null;
    const trackedKeywords = latestTracking?.content?.keywords || [];

    console.log(`Metrics: score=${siteAuditScore}, keywords=${trackedKeywords.length}`);

    // 7. Insert into report_seo_metrics
    const { error: insertError } = await supabase.from("report_seo_metrics").insert({
      client_id: clientId,
      site_audit_score: siteAuditScore,
      site_audit_issues: latestAudit?.content?.issues || null,
      tracked_keywords: trackedKeywords,
      collected_at: new Date().toISOString(),
    });

    if (insertError) {
      throw new Error(`Failed to insert SEO metrics: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SEO data synced from cache",
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
