import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/guards";
import { createClient } from "@supabase/supabase-js";
import { supabase as agencyDb } from "@/integrations/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Guard: Must be authenticated in client dashboard
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseUrl = process.env.PLAYIQ_SUPABASE_URL;
  let supabaseKey = process.env.PLAYIQ_SUPABASE_SERVICE_ROLE_KEY;

  // Fallback: If env vars not directly in Vercel environment, fetch from agency clients table
  if (!supabaseUrl || !supabaseKey) {
    try {
      const { data: clientRecord } = await agencyDb
        .from("clients")
        .select("supabase_url, api_key")
        .ilike("name", "%PlayIQ%")
        .maybeSingle();

      if (clientRecord && clientRecord.supabase_url && clientRecord.api_key) {
        supabaseUrl = clientRecord.supabase_url;
        supabaseKey = clientRecord.api_key;
      }
    } catch (e) {
      console.warn("[playiq-analytics] Failed to fetch credentials from clients table:", e);
    }
  }

  // Hard fallback default if still missing
  supabaseUrl = supabaseUrl || "https://scdbhpcnqihaswaijptx.supabase.co";

  if (!supabaseKey) {
    return NextResponse.json(
      { error: "PlayIQ database credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // Create direct client to PlayIQ Database
    const playiqDb = createClient(supabaseUrl, supabaseKey);

    // Fetch Beta Applications
    const { data: allApps, error } = await playiqDb
      .from('beta_applications')
      .select('id, parent_full_name, email, child_age_band, status, source, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const totalCount = allApps?.length || 0;
    const pendingCount = (allApps || []).filter((a: any) => a.status === 'pending').length;
    const paidCount = (allApps || []).filter((a: any) => a.status === 'paid' || a.status === 'fulfilled_promo').length;
    
    // Calculate source breakdown
    let emailCount = 0;
    let socialCount = 0;
    let otherCount = 0;
    const otherBreakdown: Record<string, number> = {};

    (allApps || []).forEach((app: any) => {
      let s = (app.source || 'direct_traffic').toLowerCase();
      if (s === 'web_form') s = 'direct_traffic';

      if (s.includes('email')) {
        emailCount++;
      } else if (s.includes('social') || s === 'facebook' || s === 'instagram') {
        socialCount++;
      } else {
        otherCount++;
        otherBreakdown[s] = (otherBreakdown[s] || 0) + 1;
      }
    });

    return NextResponse.json({
      applications: allApps || [],
      metrics: {
        totalCount,
        pendingCount,
        paidCount,
        sourceBreakdown: {
          emailCount,
          socialCount,
          otherCount,
          otherBreakdown
        }
      }
    });
  } catch (err) {
    console.error("[playiq-analytics] Query failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch PlayIQ analytics" },
      { status: 500 }
    );
  }
}
