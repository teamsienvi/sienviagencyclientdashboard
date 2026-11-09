import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MCP_URL = "https://ubersuggest-mcp.neilpatelapi.com/mcp";
const MCP_TOKEN_URL = "https://ubersuggest-mcp.neilpatelapi.com/token";

async function refreshUbersuggestOAuthToken(supabase: any, refreshToken: string): Promise<string | null> {
  try {
    console.log("[sync-ubersuggest] Refreshing Ubersuggest OAuth2 token via MCP token endpoint...");
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "ubersuggest-mcp",
      refresh_token: refreshToken.replace(/^Bearer\s+/i, "").trim(),
    });

    const res = await fetch(MCP_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[sync-ubersuggest] OAuth2 token refresh failed (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    if (!data?.access_token) return null;

    const newBearer = `Bearer ${data.access_token}`;
    const nowIso = new Date().toISOString();

    await supabase
      .from("integration_credentials")
      .upsert(
        { service_name: "ubersuggest_token", token: newBearer, updated_at: nowIso },
        { onConflict: "service_name" }
      );

    if (data.refresh_token) {
      await supabase
        .from("integration_credentials")
        .upsert(
          { service_name: "ubersuggest_refresh_token", token: data.refresh_token, updated_at: nowIso },
          { onConflict: "service_name" }
        );
    }

    console.log("[sync-ubersuggest] ✓ Ubersuggest OAuth2 token refreshed and saved to integration_credentials.");
    return newBearer;
  } catch (err) {
    console.error("[sync-ubersuggest] Exception refreshing OAuth2 token:", err);
    return null;
  }
}

async function callUbersuggestMcp(bearerToken: string, toolName: string, args: Record<string, any>): Promise<any> {
  const cleanBearer = bearerToken.startsWith("Bearer ") ? bearerToken : `Bearer ${bearerToken}`;
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": cleanBearer,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 100000),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`MCP ${toolName} returned HTTP ${res.status}`);
  }

  const text = await res.text();
  const dataLines = text.split("\n").filter((l) => l.startsWith("data: "));
  if (dataLines.length > 0) {
    const lastJson = JSON.parse(dataLines[dataLines.length - 1].slice(6));
    const contentText = lastJson?.result?.content?.[0]?.text;
    return contentText ? JSON.parse(contentText) : lastJson;
  }
  const parsed = JSON.parse(text);
  const contentText = parsed?.result?.content?.[0]?.text;
  return contentText ? JSON.parse(contentText) : parsed;
}

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

    // 1. Load credentials (token, refresh_token, session)
    const [{ data: tokenCred }, { data: refreshCred }, { data: sessionCred }] = await Promise.all([
      supabase.from("integration_credentials").select("token, updated_at").eq("service_name", "ubersuggest_token").maybeSingle(),
      supabase.from("integration_credentials").select("token, updated_at").eq("service_name", "ubersuggest_refresh_token").maybeSingle(),
      supabase.from("integration_credentials").select("token, updated_at").eq("service_name", "ubersuggest_session").maybeSingle(),
    ]);

    let currentBearer = tokenCred?.token || "";
    const refreshToken = refreshCred?.token || "";

    // Proactively refresh token if older than 20 hours (Ubersuggest OAuth2 tokens expire every 48h)
    const tokenAgeHours = tokenCred?.updated_at
      ? (Date.now() - new Date(tokenCred.updated_at).getTime()) / (1000 * 60 * 60)
      : 999;

    if (refreshToken && (!currentBearer || tokenAgeHours > 20)) {
      const refreshed = await refreshUbersuggestOAuthToken(supabase, refreshToken);
      if (refreshed) currentBearer = refreshed;
    }

    if (!currentBearer) {
      return new Response(
        JSON.stringify({ error: "Ubersuggest credentials not found." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buildAuthHeaders = (bearer: string) => ({
      Authorization: bearer.startsWith("Bearer ") ? bearer : `Bearer ${bearer}`,
      ...(sessionCred?.token ? { Cookie: `id=${sessionCred.token}` } : {}),
      Accept: "application/json",
      ts: String(Math.floor(Date.now() / 1000)),
    });

    let authHeaders = buildAuthHeaders(currentBearer);

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

    // 3. Fetch projects (auto-refreshing OAuth2 token on 401 if refresh_token is available)
    let projectsRes = await fetch("https://app.neilpatel.com/api/projects", {
      headers: authHeaders,
    });

    if (projectsRes.status === 401 && refreshToken) {
      const refreshed = await refreshUbersuggestOAuthToken(supabase, refreshToken);
      if (refreshed) {
        currentBearer = refreshed;
        authHeaders = buildAuthHeaders(currentBearer);
        projectsRes = await fetch("https://app.neilpatel.com/api/projects", {
          headers: authHeaders,
        });
      }
    }

    let projectsArray: any[] = [];
    if (projectsRes.ok) {
      const projectsRaw = await projectsRes.json();
      projectsArray = Array.isArray(projectsRaw)
        ? projectsRaw
        : projectsRaw.projects || projectsRaw.data || projectsRaw.result || [];
    } else {
      // Try MCP list_projects fallback
      try {
        const mcpProjects = await callUbersuggestMcp(currentBearer, "list_projects", {});
        projectsArray = mcpProjects?.projects || (Array.isArray(mcpProjects) ? mcpProjects : []);
      } catch (mcpErr) {
        console.warn("[sync-ubersuggest] MCP list_projects also failed:", mcpErr);
      }
    }

    if (projectsArray.length === 0) {
      // Fallback: check if client already has cached SEO metrics so we don't fail sync_state_registry
      const { data: cachedSeo } = await supabase
        .from("report_seo_metrics")
        .select("id, collected_at")
        .eq("client_id", clientId)
        .order("collected_at", { ascending: false })
        .limit(1);

      if (cachedSeo && cachedSeo.length > 0) {
        console.warn(`[sync-ubersuggest] Ubersuggest /api/projects unavailable — serving cached snapshot (${cachedSeo[0].collected_at}).`);
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            message: "Ubersuggest session expired — using latest stored SEO snapshot",
            data: { synced: false, cached: true },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Ubersuggest /api/projects returned ${projectsRes.status}.`);
    }

    const activeProject = projectsArray.find(
      (p: any) =>
        normalize(p.domain) === normalizedTarget ||
        normalize(p.url) === normalizedTarget ||
        normalize(p.name) === normalizedTarget ||
        normalize(p.title) === normalizedTarget
    );

    if (!activeProject) {
      const tracked = projectsArray.map((p: any) => `[ID:${p.id} Domain:${p.domain}]`).join(", ");
      throw new Error(`Domain ${targetDomain} not found in Ubersuggest projects. Tracked: ${tracked || "(none)"}`);
    }

    const projectId = activeProject.id;
    const locId = activeProject?.locations?.[0]?.loc_id || 2840;
    const lang = activeProject?.locations?.[0]?.lang || "en";
    console.log(`Resolved ${targetDomain} → projectId ${projectId} (locId=${locId}, lang=${lang})`);

    // 4. Fetch alerts from REST API
    let projectAlerts: any[] = [];
    try {
      const alertsRes = await fetch("https://app.neilpatel.com/api/user/alerts", {
        headers: authHeaders,
      });
      if (alertsRes.ok) {
        const allAlertsData: any[] = await alertsRes.json();
        projectAlerts = Array.isArray(allAlertsData)
          ? allAlertsData.filter((a: any) => a.projectId === projectId || a.project_id === projectId)
          : [];
      }
    } catch (e) {
      console.warn("[sync-ubersuggest] Alerts fetch warning:", e);
    }

    const siteAudits = projectAlerts.filter((a: any) => a.alertType === "site_audit" || a.alert_type === "site_audit");
    const latestAudit = siteAudits[0] ?? null;
    const siteAuditScore = latestAudit?.content?.score?.new ?? activeProject.score ?? null;

    const positionTrackings = projectAlerts.filter(
      (a: any) => a.alertType === "position_tracking" || a.alert_type === "position_tracking"
    );
    const kwMap = new Map<string, any>();
    for (const alert of [...positionTrackings].reverse()) {
      for (const kw of (alert.content?.keywords || [])) {
        kwMap.set(kw.keyword, kw);
      }
    }
    const trackedKeywords = Array.from(kwMap.values());

    // 4.2 Fetch Direct Site Audit Score and Issues via Ubersuggest MCP (site_audit_status / site_audit)
    let directSiteAuditScore: number | null = null;
    let directSiteAuditIssues: any = null;
    try {
      let mcpAudit = await callUbersuggestMcp(currentBearer, "site_audit_status", { domain: targetDomain }).catch(() => null);
      if (!mcpAudit?.result?.report?.overview) {
        mcpAudit = await callUbersuggestMcp(currentBearer, "site_audit", { domain: targetDomain, recrawl: false }).catch(() => null);
      }
      const report = mcpAudit?.result?.report;
      if (report?.overview) {
        directSiteAuditScore = report.overview.overall_score != null
          ? Math.round(Number(report.overview.overall_score))
          : null;
        const cats = report.issues_per_category || {};
        const nonZeroIssues = [
          ...(cats.errors?.issues || []),
          ...(cats.warnings?.issues || []),
          ...(cats.recommendations?.issues || []),
        ]
          .filter((i: any) => (i.count ?? 0) > 0)
          .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0));

        directSiteAuditIssues = {
          total: report.overview.total_issues_count ?? nonZeroIssues.reduce((s: number, i: any) => s + (i.count || 0), 0),
          new: latestAudit?.content?.issues?.new ?? 0,
          fixed: latestAudit?.content?.issues?.fixed ?? 0,
          highest_impact: nonZeroIssues.slice(0, 6).map((i: any) => ({
            id: i.id,
            count: i.count,
            difficulty: i.difficulty || "moderate",
            seo_impact: i.seo_impact || "medium",
          })),
        };
        console.log(`[sync-ubersuggest] MCP site_audit_status for ${targetDomain}: score=${directSiteAuditScore}, issues=${directSiteAuditIssues.total}`);
      }
    } catch (e) {
      console.error(`[sync-ubersuggest] MCP site_audit_status failed for ${targetDomain}:`, e);
    }

    // 4.3 Fetch Direct Rank Tracking keywords via Ubersuggest MCP (project_position_info)
    let directTrackedKeywords: any[] = [];
    let mcpRankSummary: any = null;
    try {
      const now = new Date();
      const endDate = now.toISOString().split("T")[0];
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const posRes = await callUbersuggestMcp(currentBearer, "project_position_info", {
        project_id: projectId,
        startDate,
        endDate,
        locId,
        language: lang,
        device: "desktop",
      });

      const list = posRes?.keywords || [];
      if (Array.isArray(list) && list.length > 0) {
        directTrackedKeywords = list.map((item: any) => {
          const dNew = item.new_position?.position ?? item.position ?? item.desktop_new ?? null;
          const dOld = item.old_position?.position ?? item.position_prev ?? item.desktop_old ?? null;
          const dChange = dNew != null && dOld != null ? dOld - dNew : null;
          return {
            keyword: item.keyword,
            volume: item.volume ?? null,
            desktop_new: dNew,
            desktop_old: dOld,
            desktop_change: dChange,
            focus_device: "desktop",
            rank_status: item.status ?? item.rank_status ?? (item.marked_unstable ? "unstable" : "ok"),
            marked_unstable: Boolean(item.marked_unstable || item.status === "unstable"),
            url: item.new_position?.url ?? item.old_position?.url ?? item.url ?? null,
          };
        });

        const avgPositions = posRes?.average_positions?.positions || [];
        const latestAvg = avgPositions.length > 0 ? avgPositions[avgPositions.length - 1]?.position ?? null : null;
        const firstAvg = avgPositions.length > 1 ? avgPositions[0]?.position ?? null : latestAvg;

        mcpRankSummary = {
          total_keywords: list.length,
          avg_position_new: latestAvg,
          avg_position_old: firstAvg,
          avg_position_change: latestAvg != null && firstAvg != null ? Number((latestAvg - firstAvg).toFixed(2)) : null,
          top_3: posRes?.binned?.top_3 ?? { old: 0, new: 0 },
          top_10: posRes?.binned?.top_10 ?? { old: 0, new: 0 },
          top_100: posRes?.binned?.top_100 ?? { old: 0, new: 0 },
          not_ranked: posRes?.binned?.not_ranking ?? { old: list.length, new: list.length },
          average_positions_series: avgPositions,
        };
        console.log(`[sync-ubersuggest] MCP project_position_info for ${targetDomain}: ${directTrackedKeywords.length} keywords`);
      }
    } catch (e) {
      console.error(`[sync-ubersuggest] MCP project_position_info failed for ${targetDomain}:`, e);
    }

    // 4.5 Fetch recent SEO metrics from DB to preserve historical scores/issues/positions
    const { data: previousRows } = await supabase
      .from("report_seo_metrics")
      .select("site_audit_score, site_audit_issues, tracked_keywords, raw_project_data")
      .eq("client_id", clientId)
      .order("collected_at", { ascending: false })
      .limit(10);

    let lastValidScore: number | null = null;
    let lastValidIssues: any = null;
    let lastValidKeywords: any[] = [];
    let lastRankSummary: any = null;

    if (previousRows) {
      for (const row of previousRows) {
        if (lastValidScore === null && row.site_audit_score !== null) lastValidScore = row.site_audit_score;
        if (lastValidIssues === null && row.site_audit_issues !== null) lastValidIssues = row.site_audit_issues;
        if (!lastRankSummary && row.raw_project_data?.rank_tracking_summary) {
          lastRankSummary = row.raw_project_data.rank_tracking_summary;
        }
        if (lastValidKeywords.length === 0 && row.tracked_keywords && row.tracked_keywords.length > 0) {
          const stored = row.tracked_keywords as any[];
          const hasRealData = stored.some((k: any) => k.desktop_new !== null || k.volume != null || k.rank_status != null);
          if (hasRealData) lastValidKeywords = stored;
        }
      }
    }

    const rawScore = directSiteAuditScore ?? siteAuditScore ?? lastValidScore ?? null;
    const finalAuditScore = rawScore !== null && rawScore !== undefined ? Math.round(Number(rawScore)) : null;
    let finalAuditIssues = directSiteAuditIssues ?? lastValidIssues ?? null;
    if (latestAudit?.content?.issues && (!finalAuditIssues || !finalAuditIssues.highest_impact?.length)) {
      finalAuditIssues = {
        ...latestAudit.content.issues,
        highest_impact: latestAudit.content.highest_impact || [],
      };
    }

    // Build final keyword list: start with DB history, overlay MCP rank tracking, preserve non-null positions if MCP reports temporary unstable null
    const dbKwMap = new Map<string, any>();
    for (const kw of lastValidKeywords) {
      dbKwMap.set((kw as any).keyword, kw);
    }
    for (const kw of directTrackedKeywords) {
      const prev = dbKwMap.get(kw.keyword);
      if (prev && prev.desktop_new !== null && kw.desktop_new === null && kw.marked_unstable) {
        // Keep known position if Ubersuggest SERP check is temporarily unstable
        dbKwMap.set(kw.keyword, {
          ...kw,
          desktop_new: prev.desktop_new,
          desktop_old: prev.desktop_old,
          desktop_change: prev.desktop_change,
          rank_status: "ok",
          marked_unstable: false,
        });
      } else {
        dbKwMap.set(kw.keyword, kw);
      }
    }
    for (const kw of trackedKeywords) {
      if (kw.desktop_new !== null) {
        dbKwMap.set(kw.keyword, { ...dbKwMap.get(kw.keyword), ...kw });
      }
    }
    let finalTrackedKeywords = Array.from(dbKwMap.values());

    // Enforce 1:1 parity with activeProject.keywords
    if (activeProject?.keywords) {
      const activeKwKeys = Object.keys(activeProject.keywords);
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
      finalTrackedKeywords = finalTrackedKeywords.filter((k: any) => activeKwKeys.includes(k.keyword));
    }

    // Recompute rank_tracking_summary if any finalTrackedKeywords have desktop_new != null
    const rankedFinal = finalTrackedKeywords.filter((k: any) => k.desktop_new !== null && k.desktop_new !== undefined);
    const finalRankSummary = rankedFinal.length > 0 && (!mcpRankSummary || mcpRankSummary.avg_position_new === null)
      ? (lastRankSummary || mcpRankSummary)
      : (mcpRankSummary || lastRankSummary);

    console.log(`Final Metrics for ${targetDomain}: score=${finalAuditScore}, issues=${finalAuditIssues?.total ?? 0}, keywords=${finalTrackedKeywords.length} (ranked=${rankedFinal.length})`);

    let fullProjectData = null;
    try {
      const pRes = await fetch("https://app.neilpatel.com/api/projects/" + projectId, { headers: authHeaders });
      if (pRes.ok) fullProjectData = await pRes.json();
    } catch (e) {
      console.error(`Failed to fetch full project data for ${projectId}:`, e);
    }

    let domainOverview = null;
    try {
      const overviewUrl = `https://app.neilpatel.com/api/domain_overview?domain=${targetDomain}&locId=${locId}&lang=${lang}`;
      const oRes = await fetch(overviewUrl, { headers: authHeaders });
      if (oRes.ok) {
        const oData = await oRes.json();
        domainOverview = oData.result || oData;
      } else {
        domainOverview = await callUbersuggestMcp(currentBearer, "domain_overview", {
          domain: targetDomain,
          locId,
          language: lang,
        }).catch(() => null);
      }
    } catch (e) {
      console.error(`Failed to fetch domain overview for ${targetDomain}:`, e);
    }

    const mergedProjectData = {
      ...(fullProjectData?.project || activeProject),
      domain_overview: domainOverview,
      ...(finalRankSummary ? { rank_tracking_summary: finalRankSummary } : {}),
    };

    const nowIso = new Date().toISOString();

    // 5. Insert into report_seo_metrics
    const { error: insertError } = await supabase.from("report_seo_metrics").insert({
      client_id: clientId,
      site_audit_score: finalAuditScore,
      site_audit_issues: finalAuditIssues,
      tracked_keywords: finalTrackedKeywords,
      raw_project_data: mergedProjectData,
      collected_at: nowIso,
    });

    if (insertError) {
      console.error(`DB Insert Error for ${targetDomain}:`, insertError);
      throw insertError;
    }

    // 6. Mark sync_state_registry as ready for seo / ubersuggest
    const staleAfterIso = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    for (const mod of ["seo", "ubersuggest"]) {
      await supabase.from("sync_state_registry").upsert(
        {
          client_id: clientId,
          platform: "seo",
          module: mod,
          status: "ready",
          job_locked_until: null,
          last_synced_at: nowIso,
          last_success_at: nowIso,
          stale_after_at: staleAfterIso,
          retry_count: 0,
          error_message: null,
        },
        { onConflict: "client_id,platform,module" }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SEO data synced via Ubersuggest MCP",
        data: {
          synced: true,
          domain: targetDomain,
          site_audit_score: finalAuditScore,
          total_issues: finalAuditIssues?.total ?? 0,
          tracked_keywords_count: finalTrackedKeywords.length,
          ranked_keywords_count: rankedFinal.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error
      ? error.message
      : (typeof error === "object" && error !== null && "message" in error)
        ? String((error as any).message)
        : JSON.stringify(error);
    console.error("Edge function error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
