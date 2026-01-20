import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRICOOL_BASE_URL = "https://app.metricool.com";

interface TikTokFollowersRequest {
  from: string;
  to: string;
  timezone?: string;
  userId: string;
  blogId: string;
  clientId?: string; // Optional: if provided, will persist timeline to database
}

type MetricoolTimelinePoint = {
  dateTime?: string;
  date?: string;
  timestamp?: string;
  value?: number;
  followers?: number;
  count?: number;
};

const toDateOnly = (s: string): string => {
  // Handle both ISO and date strings; always return YYYY-MM-DD
  return s.length >= 10 ? s.slice(0, 10) : s;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metricoolAuth = Deno.env.get("METRICOOL_AUTH");
    if (!metricoolAuth) {
      console.error("METRICOOL_AUTH secret not configured");
      return new Response(
        JSON.stringify({ error: "METRICOOL_AUTH secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: TikTokFollowersRequest = await req.json();
    const { from, to, timezone, userId, blogId, clientId } = body;

    console.log("metricool-tiktok-followers request:", {
      from,
      to,
      timezone,
      userId,
      blogId,
      clientId,
    });

    if (!from || !to || !userId || !blogId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: from, to, userId, blogId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL using URLSearchParams to properly encode special characters
    const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/timelines`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("metric", "followers_count");
    url.searchParams.set("network", "tiktok");
    url.searchParams.set("subject", "account");
    url.searchParams.set("timezone", timezone || "UTC");
    url.searchParams.set("userId", userId.toString());
    url.searchParams.set("blogId", blogId.toString());

    console.log("Calling Metricool timelines API:", url.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-mc-auth": metricoolAuth,
        accept: "application/json",
      },
    });

    console.log("Metricool response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Metricool API error:", response.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Metricool API returned an error",
          upstreamStatus: response.status,
          upstreamBody: errorText,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Metricool timelines response:", JSON.stringify(data).slice(0, 500));

    let persisted = { enabled: false, inserted: 0 };

    // Optional: persist follower timeline snapshots
    if (clientId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const values: MetricoolTimelinePoint[] =
          data?.data?.[0]?.values && Array.isArray(data.data[0].values) ? data.data[0].values : [];

        const nowIso = new Date().toISOString();
        const records = values
          .map((point) => {
            const dateStr = point.dateTime || point.date || point.timestamp;
            if (!dateStr) return null;
            return {
              client_id: clientId,
              platform: "tiktok",
              date: toDateOnly(String(dateStr)),
              followers: Number(point.value ?? point.followers ?? point.count ?? 0),
              collected_at: nowIso,
            };
          })
          .filter(Boolean) as Array<{ client_id: string; platform: string; date: string; followers: number; collected_at: string }>;

        if (records.length > 0) {
          const dates = records.map((r) => r.date);

          await supabase
            .from("social_follower_timeline")
            .delete()
            .eq("client_id", clientId)
            .eq("platform", "tiktok")
            .in("date", dates);

          const { data: inserted, error: insertError } = await supabase
            .from("social_follower_timeline")
            .insert(records)
            .select();

          if (insertError) {
            console.error("Failed to persist follower timeline:", insertError);
          } else {
            persisted = { enabled: true, inserted: inserted?.length || 0 };
            console.log(`Persisted follower timeline rows: ${persisted.inserted}`);
          }
        } else {
          persisted = { enabled: true, inserted: 0 };
          console.log("No timeline values to persist");
        }
      } catch (e) {
        console.error("Error persisting follower timeline:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data, persisted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in metricool-tiktok-followers:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
