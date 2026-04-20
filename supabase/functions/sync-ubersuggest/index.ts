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

    // 1. Fetch Ubersuggest session cookies (stored as cookie string by the Playwright refresh script)
    const { data: credentials, error: credError } = await supabase
      .from('integration_credentials')
      .select('token')
      .eq('service_name', 'ubersuggest')
      .single();

    if (credError || !credentials?.token) {
      return new Response(
        JSON.stringify({ error: "Ubersuggest session not found. Run the GitHub Actions token refresh first." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // The stored token is a cookie string: "name=value; name2=value2"
    const UBERSUGGEST_COOKIE = credentials.token;

    // 2. Fetch SEO config for the client
    const { data: config, error: configError } = await supabase
      .from('client_seo_config')
      .select('domain')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (configError || !config?.domain) {
      return new Response(
        JSON.stringify({ error: `No active SEO config mapped for client ${clientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const targetDomain = config.domain;

    // 3. Fetch all projects to resolve domain to projectId
    const projectsResponse = await fetch("https://app.neilpatel.com/api/projects", {
      headers: { "Cookie": UBERSUGGEST_COOKIE, "Accept": "application/json" }
    });

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch Ubersuggest projects: ${projectsResponse.status}`);
    }

    const projectsData = await projectsResponse.json();
    console.log("Raw projects API response:", JSON.stringify(projectsData).slice(0, 500));
    
    // Handle multiple possible response shapes
    const projectsArray = Array.isArray(projectsData)
      ? projectsData
      : projectsData.projects || projectsData.data || projectsData.result || [];
    
    console.log(`Found ${projectsArray.length} projects. Domains: ${projectsArray.map((p: any) => p.domain || p.url || p.name).join(', ')}`);

    // Flexible domain match: handle www prefix and trailing slashes
    const normalize = (d: string) => d?.replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
    const normalizedTarget = normalize(targetDomain);
    const activeProject = projectsArray.find((p: any) =>
      normalize(p.domain) === normalizedTarget ||
      normalize(p.url) === normalizedTarget ||
      normalize(p.name) === normalizedTarget
    );

    if (!activeProject) {
      const tracked = projectsArray.map((p: any) => p.domain || p.url || p.name).join(', ');
      throw new Error(`Domain ${targetDomain} not tracked. Tracked domains are: ${tracked || '(none found — token may be invalid)'}`);
    }
    const projectId = activeProject.id;
    console.log(`Resolved domain ${targetDomain} to projectId ${projectId}`);


    // 4. Fetch the User Alerts to extract metrics
    const alertsResponse = await fetch("https://app.neilpatel.com/api/user/alerts", {
      headers: { "Cookie": UBERSUGGEST_COOKIE, "Accept": "application/json" }
    });

    if (!alertsResponse.ok) {
      throw new Error(`Failed to fetch Ubersuggest alerts: ${alertsResponse.status}`);
    }

    const allAlerts = await alertsResponse.json();
    
    // Filter alerts for our specific project
    const projectAlerts = allAlerts.filter((a: any) => a.projectId === projectId);
    
    // Extract newest site audit score
    const siteAudits = projectAlerts.filter((a: any) => a.alertType === "site_audit");
    const latestAudit = siteAudits.length > 0 ? siteAudits[0] : null;
    const siteAuditScore = latestAudit?.content?.score?.new || null;
    
    // Extract newest keyword position tracking
    const positionTrackings = projectAlerts.filter((a: any) => a.alertType === "position_tracking");
    const latestTracking = positionTrackings.length > 0 ? positionTrackings[0] : null;
    const trackedKeywords = latestTracking?.content?.keywords || [];

    console.log(`Metrics extracted - Score: ${siteAuditScore}, Keywords tracked: ${trackedKeywords.length}`);

    // 5. Safely upsert into report_seo_metrics
    const { error: upsertError } = await supabase.from("report_seo_metrics").insert({
      client_id: clientId,
      site_audit_score: siteAuditScore,
      site_audit_issues: latestAudit?.content?.issues || null,
      tracked_keywords: trackedKeywords,
      collected_at: new Date().toISOString()
    });

    if (upsertError) {
      throw new Error(`Failed to upsert SEO metrics: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "SEO data synced", 
        data: {
          domain: targetDomain,
          siteAuditScore,
          trackedKeywordsCount: trackedKeywords.length
        }
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
