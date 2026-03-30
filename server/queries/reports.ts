import { createClient } from "@/lib/supabase/server";

/**
 * Server-side report queries.
 */

/** Check if a report exists and return its client_id. */
export async function getReportClientId(reportId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("client_id")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) return null;
  return data.client_id;
}
