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
    // Merge ALL position_tracking alerts oldest→newest to get a full current snapshot.
    // Ubersuggest only sends keywords that CHANGED in each alert, not the full list.
    // By accumulating all alerts we reconstruct the complete rankings picture.
    const kwMap = new Map<string, any>();
    for (const alert of [...positionTrackings].reverse()) {
      for (const kw of (alert.content?.keywords || [])) {
        const existing = kwMap.get(kw.keyword);
        // Keep the entry from the most recent alert (last write wins as we iterate oldest→newest)
        kwMap.set(kw.keyword, kw);
      }
    }
    const trackedKeywords = Array.from(kwMap.values());

    // 4.5 Fetch recent SEO metrics to fall back to if no new alerts
    const { data: previousRows } = await supabase
      .from("report_seo_metrics")
      .select("site_audit_score, site_audit_issues, tracked_keywords")
      .eq("client_id", clientId)
      .order("collected_at", { ascending: false })
      .limit(10);

    let lastValidScore = null;
    let lastValidIssues = null;
    let lastValidKeywords = [];

    if (previousRows) {
      for (const row of previousRows) {
        if (lastValidScore === null && row.site_audit_score !== null) lastValidScore = row.site_audit_score;
        if (lastValidIssues === null && row.site_audit_issues !== null) lastValidIssues = row.site_audit_issues;
        if (lastValidKeywords.length === 0 && row.tracked_keywords && row.tracked_keywords.length > 0) {
          // When loading from DB, prefer rows where at least some keywords have real position data
          const stored = row.tracked_keywords as any[];
          const hasRealData = stored.some((k: any) => k.desktop_new !== null);
          if (hasRealData) lastValidKeywords = stored;
        }
      }
    }

    const finalAuditScore = siteAuditScore ?? lastValidScore ?? null;
    let finalAuditIssues = lastValidIssues ?? null;
    if (latestAudit?.content?.issues) {
      finalAuditIssues = {
        ...latestAudit.content.issues,
        highest_impact: latestAudit.content.highest_impact || []
      };
    }
    // Build final keyword list: start with DB history as a base,
    // then overlay the fresh alert data for any keywords that appear in it.
    // This ensures keywords that didn't change still show their last known position.
    const dbKwMap = new Map<string, any>();
    for (const kw of lastValidKeywords) {
      dbKwMap.set((kw as any).keyword, kw);
    }
    // Fresh alert data overwrites DB data for the same keyword
    for (const kw of trackedKeywords) {
      dbKwMap.set(kw.keyword, kw);
    }
    let finalTrackedKeywords = Array.from(dbKwMap.values());

    // Enforce 1:1 parity with activeProject.keywords
    if (activeProject?.keywords) {
      const activeKwKeys = Object.keys(activeProject.keywords);
      
      // 1. Add any new keywords that don't have any data yet (pending crawl)
      const existingKwKeys = new Set(finalTrackedKeywords.map((k: any) => k.keyword));
      for (const kw of activeKwKeys) {
        if (!existingKwKeys.has(kw)) {
          finalTrackedKeywords.push({
            keyword: kw,
            volume: null,
            desktop_new: null,
            desktop_old: null,
            focus_device: "desktop",
          });
        }
      }
      
      // 2. Remove any keywords that were deleted from the Ubersuggest project
      finalTrackedKeywords = finalTrackedKeywords.filter((k: any) => activeKwKeys.includes(k.keyword));
    }


    console.log(`Final Metrics: score=${finalAuditScore}, keywords=${finalTrackedKeywords.length}`);

    let fullProjectData = null;
    try {
      const pRes = await fetch("https://app.neilpatel.com/api/projects/" + projectId, { headers: authHeaders });
      if (pRes.ok) fullProjectData = await pRes.json();
    } catch(e) {
      console.error(`Failed to fetch full project data for ${projectId}:`, e);
    }

    let domainOverview = null;
    let oStatus = null;
    let oData = null;
    try {
      const locId = activeProject?.locations?.[0]?.loc_id || 2840;
      const lang = activeProject?.locations?.[0]?.lang || "en";
      const overviewUrl = `https://app.neilpatel.com/api/domain_overview?domain=${targetDomain}&locId=${locId}&lang=${lang}`;
      const oRes = await fetch(overviewUrl, { headers: authHeaders });
      oStatus = oRes.status;
      if (oRes.ok) {
        oData = await oRes.json();
        domainOverview = oData.result || oData;
      }
    } catch(e) {
      console.error(`Failed to fetch domain overview for ${targetDomain}:`, e);
    }

    const mergedProjectData = {
      ...(fullProjectData?.project || activeProject),
      domain_overview: domainOverview
    };

    // 5. Insert into report_seo_metrics
    const { error: insertError } = await supabase.from("report_seo_metrics").insert({
      client_id: clientId,
      site_audit_score: finalAuditScore,
      site_audit_issues: finalAuditIssues,
      tracked_keywords: finalTrackedKeywords,
      raw_project_data: mergedProjectData,
      collected_at: new Date().toISOString()
    });

    if (insertError) {
      console.error(`DB Insert Error for ${targetDomain}:`, insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SEO data synced",
        data: { synced: true },
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
