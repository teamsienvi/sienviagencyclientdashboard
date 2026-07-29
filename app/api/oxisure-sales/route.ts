/**
 * API route: GET /api/oxisure-sales
 * Returns OxiSure Retention App sales analytics.
 * Admin-only access. Accepts ?range=7d|30d|90d|all (default: 30d).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth/guards";
import { getOxiSureStats } from "@/server/queries/oxisure";

export const dynamic = "force-dynamic";

const VALID_RANGES = new Set(["7d", "30d", "90d", "all"]);

export async function GET(request: NextRequest) {
  // Admin guard — service role data should only be accessible to agency admins
  const ctx = await getCurrentUserContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse range query param
  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range") ?? "30d";
  const range = VALID_RANGES.has(rangeParam)
    ? (rangeParam as "7d" | "30d" | "90d" | "all")
    : "30d";

  try {
    const stats = await getOxiSureStats(range);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[oxisure-sales] Query failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch OxiSure sales data" },
      { status: 500 }
    );
  }
}
