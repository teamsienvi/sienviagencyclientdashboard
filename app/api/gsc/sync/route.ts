import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, row } = body || {};

    if (!clientId || !row) {
      return NextResponse.json(
        { error: "Missing required clientId or row payload" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Server Supabase credentials not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Upsert into report_gsc_metrics
    const nowIso = new Date().toISOString();
    const payload = {
      ...row,
      client_id: clientId,
      collected_at: nowIso,
    };

    const { error: upsertError } = await supabase
      .from("report_gsc_metrics")
      .upsert(payload, { onConflict: "client_id,date_range_start,date_range_end" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // 2. Build authoritative GSC summary metrics object from the uploaded row
    const daily = Array.isArray(payload.daily_breakdown) ? payload.daily_breakdown : [];
    let gscClicks = payload.total_clicks || 0;
    let gscImpressions = payload.total_impressions || 0;
    let gscCtr = parseFloat(payload.avg_ctr) || 0;
    let gscPosition = parseFloat(payload.avg_position) || 0;
    let windowLabel = `Last 7 Days (${payload.date_range_start} to ${payload.date_range_end})`;

    if (daily.length > 7) {
      const sortedDaily = [...daily].sort((a: any, b: any) =>
        String(a.date).localeCompare(String(b.date))
      );
      const last7 = sortedDaily.slice(-7);
      gscClicks = last7.reduce((s: number, d: any) => s + (d.clicks || 0), 0);
      gscImpressions = last7.reduce((s: number, d: any) => s + (d.impressions || 0), 0);
      gscCtr = gscImpressions > 0 ? (gscClicks / gscImpressions) * 100 : 0;
      gscPosition =
        last7.length > 0
          ? last7.reduce((s: number, d: any) => s + (d.position || 0), 0) / last7.length
          : 0;
      windowLabel = `Last 7 Days (${last7[0]?.date} to ${last7[last7.length - 1]?.date})`;
    }

    const gscMetricsPatch = {
      has_gsc: true,
      gsc: {
        clicks: gscClicks,
        impressions: gscImpressions,
        ctr: gscCtr,
        position: gscPosition,
        window: windowLabel,
      },
      gsc_clicks: gscClicks,
      gsc_impressions: gscImpressions,
      gsc_ctr: gscCtr,
      gsc_position: gscPosition,
    };

    const patchSummariesWithLatestGsc = async () => {
      const { data: existingSummaries } = await supabase
        .from("analytics_summaries")
        .select("id, type, summary_data")
        .eq("client_id", clientId)
        .in("type", ["seo", "website"]);

      if (existingSummaries && existingSummaries.length > 0) {
        await Promise.all(
          existingSummaries.map((s: any) => {
            const curData = s.summary_data || {};
            const curMetrics = curData.metrics || {};
            const updatedSummaryData = {
              ...curData,
              metrics: {
                ...curMetrics,
                ...gscMetricsPatch,
              },
            };
            return supabase
              .from("analytics_summaries")
              .update({
                summary_data: updatedSummaryData,
                generated_at: new Date().toISOString(),
              })
              .eq("id", s.id);
          })
        );
      }
    };

    // Immediately patch existing summaries so metrics are never stale
    await patchSummariesWithLatestGsc();

    // 3. Regenerate both SEO and Website AI summaries in parallel
    await Promise.allSettled([
      supabase.functions.invoke("generate-analytics-summary", {
        body: { clientId, type: "seo", dateRange: "7d" },
      }),
      supabase.functions.invoke("generate-analytics-summary", {
        body: { clientId, type: "website", dateRange: "7d" },
      }),
    ]);

    // 4. Re-apply authoritative GSC metrics patch and mark sync_registry ready
    await patchSummariesWithLatestGsc();

    const staleAfterIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("sync_state_registry")
      .update({
        status: "ready",
        last_synced_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        stale_after_at: staleAfterIso,
        retry_count: 0,
        error_message: null,
        job_locked_until: null,
      })
      .eq("client_id", clientId)
      .in("module", ["seo_summary", "website_summary"]);

    return NextResponse.json({
      success: true,
      gsc: gscMetricsPatch.gsc,
    });
  } catch (err: any) {
    console.error("Error in /api/gsc/sync:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to sync GSC data" },
      { status: 500 }
    );
  }
}
