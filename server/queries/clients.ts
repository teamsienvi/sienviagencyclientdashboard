import { createClient } from "@/lib/supabase/server";

/**
 * Fetch all active clients with their basic info.
 * Used by the admin dashboard index.
 */
export async function getActiveClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, supabase_url")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("getActiveClients error:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch active Metricool configs for rendering platform badges.
 */
export async function getActiveMetricoolConfigs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_metricool_config")
    .select("client_id, platform")
    .eq("is_active", true);

  if (error) {
    console.error("getActiveMetricoolConfigs error:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Fetch a single client's assignment for a specific user.
 */
export async function getUserClientAssignment(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_users")
    .select("client_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getUserClientAssignment error:", error);
    return null;
  }
  return data;
}
