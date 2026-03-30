"use server";

import { requireAuth, requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * Trigger a manual analytics sync for a client.
 * Validates auth and client access before invoking the edge function.
 * Available to admins and the client's own assigned users.
 */
export async function triggerManualSync(
  clientId: string,
  platform?: string
) {
  await requireClientAccess(clientId);

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("sync-social-analytics", {
    body: { clientId, platform, manual: true },
  });

  if (error) {
    throw new Error(`Sync failed: ${error.message}`);
  }

  return data;
}
