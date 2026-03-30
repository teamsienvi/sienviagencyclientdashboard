import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated user context returned by getCurrentUserContext().
 * This is the canonical shape for all server-side auth consumers.
 */
export interface UserContext {
  userId: string;
  email: string;
  isAdmin: boolean;
}

/**
 * Returns the current authenticated user's context, or null if not authenticated.
 * Uses the real production role source: the `user_roles` table (not profiles.role).
 * Does NOT redirect — callers decide what to do with a null result.
 */
export async function getCurrentUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Check admin role from the canonical `user_roles` table
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? "",
    isAdmin: !!roleRow,
  };
}

/**
 * Requires authentication. Redirects to /login if not authenticated.
 * Returns the full UserContext on success.
 */
export async function requireAuth(): Promise<UserContext> {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    redirect("/login");
  }
  return ctx;
}

/**
 * Requires admin role. Redirects to / if authenticated but not admin.
 * Redirects to /login if not authenticated at all.
 */
export async function requireAdmin(): Promise<UserContext> {
  const ctx = await requireAuth(); // handles login redirect
  if (!ctx.isAdmin) {
    redirect("/");
  }
  return ctx;
}

/**
 * Requires access to a specific client dashboard.
 * Admins can access any client. Non-admins must have a matching client_users assignment.
 * Redirects to / if access is denied.
 */
export async function requireClientAccess(clientId: string): Promise<UserContext> {
  const ctx = await requireAuth();

  if (ctx.isAdmin) {
    return ctx; // admins have universal client access
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("client_users")
    .select("client_id")
    .eq("user_id", ctx.userId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!assignment) {
    redirect("/");
  }

  return ctx;
}
