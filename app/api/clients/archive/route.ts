import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserContext } from "@/lib/auth/guards";

const SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const DEFAULT_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk1MzcwNywiZXhwIjoyMDg3NTI5NzA3fQ.hB-L59qE7061eR_FXnZ_Uh8I5pUqD8zq9IRV9en4uRA";

export async function PATCH(req: NextRequest) {
  try {
    let supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL).trim();
    if (supabaseUrl.includes("xysuapqjvwuokvylnwha")) {
      supabaseUrl = SUPABASE_URL;
    }
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY)
      .replace(/^["']|["']$/g, "")
      .trim();

    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string | null = null;
    let isAdmin = false;

    // 1. Try reading user from Authorization Bearer token if provided
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (!userError && userData?.user?.id) {
          userId = userData.user.id;
        }
      }
    }

    // 2. Otherwise verify session via cookie-based getCurrentUserContext
    if (!userId) {
      const ctx = await getCurrentUserContext();
      if (ctx?.userId) {
        userId = ctx.userId;
        isAdmin = ctx.isAdmin;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Verify admin role in canonical user_roles table using service role
    if (!isAdmin) {
      const { data: roleRow, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError) {
        console.error("user_roles check error:", roleError);
      }
      isAdmin = !!roleRow;
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // 4. Parse request body
    const body = await req.json().catch(() => ({}));
    const { clientId, archived } = body;

    if (!clientId || typeof archived !== "boolean") {
      return NextResponse.json(
        { error: "Missing clientId or archived boolean" },
        { status: 400 }
      );
    }

    // 5. Update client status in database
    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({ is_active: !archived })
      .eq("id", clientId);

    if (updateError) {
      console.error("Archive client error:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update client" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clientId,
      archived,
      message: archived
        ? "Client archived successfully"
        : "Client restored successfully",
    });
  } catch (err: any) {
    console.error("Archive route unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) || "Internal server error" },
      { status: 500 }
    );
  }
}
