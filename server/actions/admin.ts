"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions for admin-only operations.
 *
 * These actions handle auth validation and orchestration,
 * then delegate privileged work to existing Supabase Edge Functions.
 * They do NOT duplicate backend logic — they are the Next.js boundary
 * that gates access before invoking the same edge functions the legacy
 * client used to call directly.
 */

/**
 * Trigger a manual sync for a platform via the existing edge function.
 * Validates admin auth before invoking.
 */
export async function triggerPlatformSync(clientId: string, platform: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("sync-social-analytics", {
    body: { clientId, platform, manual: true },
  });

  if (error) {
    throw new Error(`Sync failed: ${error.message}`);
  }

  return data;
}

/**
 * Reset client passwords via the existing edge function.
 * Validates admin auth before invoking.
 */
export async function resetClientPasswords(clientId: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("reset-client-passwords", {
    body: { clientId },
  });

  if (error) {
    throw new Error(`Password reset failed: ${error.message}`);
  }

  return data;
}
