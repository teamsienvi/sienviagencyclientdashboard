import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentUserContext } from "@/lib/auth/guards";

const SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const DEFAULT_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk1MzcwNywiZXhwIjoyMDg3NTI5NzA3fQ.hB-L59qE7061eR_FXnZ_Uh8I5pUqD8zq9IRV9en4uRA";

export async function PATCH(req: NextRequest) {
  try {
    // Verify admin session via canonical user_roles
    const ctx = await getCurrentUserContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, archived } = body;

    if (!clientId || typeof archived !== "boolean") {
      return NextResponse.json({ error: "Missing clientId or archived boolean" }, { status: 400 });
    }

    // Use service role to bypass RLS for the update
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_KEY;
    const supabase = createSupabaseClient(supabaseUrl, serviceKey);

    const { error } = await supabase
      .from("clients")
      .update({ is_active: !archived })
      .eq("id", clientId);

    if (error) {
      console.error("Archive client error:", error);
      return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      clientId, 
      archived,
      message: archived ? "Client archived successfully" : "Client restored successfully" 
    });
  } catch (err: any) {
    console.error("Archive route error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
