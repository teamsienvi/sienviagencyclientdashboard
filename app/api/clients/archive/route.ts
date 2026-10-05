import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const DEFAULT_SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

/**
 * PATCH /api/clients/archive
 * Archives/restores a client by toggling clients.is_active.
 *
 * Runs as the logged-in user (no service role key). Authorization is enforced by
 * the "Admins can update clients" RLS policy (public.has_role(auth.uid(), 'admin')),
 * plus an explicit user_roles check here for a clear 403 message.
 */
export async function PATCH(req: NextRequest) {
  try {
    // Build a Supabase client scoped to the caller: prefer the Bearer token, fall back to cookies.
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    let supabase;
    if (token) {
      let url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
      let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
      if (!url.includes("mhuxrnxajtiwxauhlhlv")) {
        url = DEFAULT_SUPABASE_URL;
        anonKey = DEFAULT_SUPABASE_ANON_KEY;
      }
      supabase = createSupabaseClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } else {
      supabase = await createServerClient();
    }

    const { data: userData, error: userError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { clientId, archived } = body;

    if (!clientId || typeof archived !== "boolean") {
      return NextResponse.json({ error: "Missing clientId or archived boolean" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("clients")
      .update({ is_active: !archived })
      .eq("id", clientId)
      .select("id");

    if (updateError) {
      console.error("Archive client error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: "Client not found or not permitted" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      clientId,
      archived,
      message: archived ? "Client archived successfully" : "Client restored successfully",
    });
  } catch (err: any) {
    console.error("Archive route unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
