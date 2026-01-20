import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const METRICOOL_BASE_URL = "https://app.metricool.com";

interface DistributionRequest {
  metric: string; // e.g., "gender", "country", "age"
  network: string; // e.g., "tiktok", "linkedin"
  subject: string; // e.g., "account"
  from: string; // ISO date string
  to: string; // ISO date string
  timezone?: string; // optional timezone
  userId: string; // Metricool user ID (per client)
  blogId?: string; // optional Metricool blog ID (per client)
  clientId?: string; // Optional: if provided, persist demographics (TikTok)
}

type CountryEntry = { country: string; percentage: number };

const toDateOnly = (s: string): string => (s.length >= 10 ? s.slice(0, 10) : s);

const parseGender = (data: any): { male: number | null; female: number | null; unknown: number | null } => {
  // Metricool commonly returns { data: [{ key/label/name, value/percentage }] }
  const rows: any[] = data?.data && Array.isArray(data.data) ? data.data : [];

  let male: number | null = null;
  let female: number | null = null;
  let unknown: number | null = null;

  for (const r of rows) {
    const label = String(r.label ?? r.name ?? r.key ?? r.id ?? "").toLowerCase();
    const valueRaw = r.percentage ?? r.value ?? r.count ?? r.total ?? null;
    const value = valueRaw == null ? null : Number(valueRaw);

    if (!label) continue;

    if (label.includes("male")) male = value;
    else if (label.includes("female")) female = value;
    else if (label.includes("unknown") || label.includes("other")) unknown = value;
  }

  return { male, female, unknown };
};

const parseCountries = (data: any): CountryEntry[] => {
  const rows: any[] = data?.data && Array.isArray(data.data) ? data.data : [];

  const out: CountryEntry[] = rows
    .map((r) => {
      const country = String(r.country ?? r.code ?? r.key ?? r.name ?? r.label ?? "").trim();
      const valueRaw = r.percentage ?? r.value ?? r.count ?? r.total ?? null;
      const percentage = valueRaw == null ? 0 : Number(valueRaw);
      if (!country) return null;
      if (!Number.isFinite(percentage)) return null;
      return { country, percentage };
    })
    .filter(Boolean) as CountryEntry[];

  // Keep highest first for easier UI
  out.sort((a, b) => b.percentage - a.percentage);
  return out;
};

// LinkedIn requires specific subject values for distribution API
// Map generic metrics to LinkedIn-specific subjects
const getLinkedInSubject = (metric: string): string | null => {
  const linkedInSubjectMap: Record<string, string> = {
    country: "followerCountsByGeoCountry",
    geo: "followerCountsByGeo",
    industry: "aggregatedFollowerCountsByIndustry",
    seniority: "followerCountsBySeniority",
    function: "followerCountsByFunction",
    staff_count: "followerCountsByStaffCountRange",
    association: "followerCountsByAssociationType",
  };
  return linkedInSubjectMap[metric] || null;
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

    const body: DistributionRequest = await req.json();
    const { metric, network, subject, from, to, timezone, userId, blogId, clientId } = body;

    console.log("metricool-distribution request:", {
      metric,
      network,
      subject,
      from,
      to,
      timezone,
      userId,
      blogId,
      clientId,
    });

    // Validate required params
    if (!metric || !network || !subject || !from || !to || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: metric, network, subject, from, to, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LinkedIn doesn't support generic "gender" or "account" subjects for distribution
    // Return empty data gracefully instead of erroring
    if (network === "linkedin") {
      const linkedInSubject = getLinkedInSubject(metric);

      if (!linkedInSubject) {
        console.log(`LinkedIn does not support metric "${metric}" for distribution. Returning empty data.`);
        return new Response(
          JSON.stringify({ success: true, data: { data: [] }, unsupported: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use the LinkedIn-specific subject
      const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/distribution`);
      url.searchParams.set("metric", linkedInSubject);
      url.searchParams.set("network", network);
      url.searchParams.set("subject", "account"); // LinkedIn uses account with specific metric names
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      url.searchParams.set("userId", userId);
      if (blogId) url.searchParams.set("blogId", blogId);
      if (timezone) url.searchParams.set("timezone", timezone);

      console.log("Fetching LinkedIn distribution:", url.toString());

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
        // For LinkedIn, return empty data instead of error for unsupported distributions
        return new Response(
          JSON.stringify({ success: true, data: { data: [] }, unsupported: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log("Metricool LinkedIn distribution response:", JSON.stringify(data));

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For TikTok and other platforms, use original logic
    const url = new URL(`${METRICOOL_BASE_URL}/api/v2/analytics/distribution`);
    url.searchParams.set("metric", metric);
    url.searchParams.set("network", network);
    url.searchParams.set("subject", subject);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("userId", userId);
    if (blogId) url.searchParams.set("blogId", blogId);
    if (timezone) url.searchParams.set("timezone", timezone);

    console.log("Fetching Metricool distribution:", url.toString());

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
          error: "Metricool API error",
          upstreamStatus: response.status,
          body: errorText,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Metricool distribution response:", JSON.stringify(data));

    // Optional: persist TikTok demographics (manual sync)
    // We persist only for TikTok because other networks have different schemas/constraints.
    if (clientId && network === "tiktok" && (metric === "gender" || metric === "country")) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const periodStart = toDateOnly(from);
        const periodEnd = toDateOnly(to);

        const { data: existing } = await supabase
          .from("social_account_demographics")
          .select("gender_male, gender_female, gender_unknown, countries")
          .eq("client_id", clientId)
          .eq("platform", "tiktok")
          .eq("period_start", periodStart)
          .eq("period_end", periodEnd)
          .limit(1)
          .maybeSingle();

        const existingCountries = (existing?.countries ?? null) as any;

        const parsedGender = metric === "gender" ? parseGender(data) : null;
        const parsedCountries = metric === "country" ? parseCountries(data) : null;

        const merged = {
          client_id: clientId,
          platform: "tiktok",
          period_start: periodStart,
          period_end: periodEnd,
          gender_male: parsedGender ? parsedGender.male : (existing?.gender_male ?? null),
          gender_female: parsedGender ? parsedGender.female : (existing?.gender_female ?? null),
          gender_unknown: parsedGender ? parsedGender.unknown : (existing?.gender_unknown ?? null),
          countries: parsedCountries ? (parsedCountries.length > 0 ? parsedCountries : null) : (existingCountries ?? null),
          collected_at: new Date().toISOString(),
        };

        const hasAnything =
          merged.gender_male !== null ||
          merged.gender_female !== null ||
          merged.gender_unknown !== null ||
          (Array.isArray(merged.countries) && merged.countries.length > 0);

        if (hasAnything) {
          // delete-then-insert avoids unique constraint mismatch issues across environments
          await supabase
            .from("social_account_demographics")
            .delete()
            .eq("client_id", clientId)
            .eq("platform", "tiktok")
            .eq("period_start", periodStart)
            .eq("period_end", periodEnd);

          const { error: insertError } = await supabase.from("social_account_demographics").insert(merged);

          if (insertError) {
            console.error("Failed to persist TikTok demographics:", insertError);
          } else {
            console.log("Persisted TikTok demographics for period", periodStart, periodEnd);
          }
        } else {
          console.log("No demographics values to persist for", metric);
        }
      } catch (e) {
        console.error("Error persisting TikTok demographics:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in metricool-distribution:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
