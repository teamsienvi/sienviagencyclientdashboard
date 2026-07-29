/**
 * Server-only Supabase client for the OxiSure Retention App database.
 * Uses the service role key for RLS-bypassing read access.
 *
 * WHY: The agency dashboard needs to read order/sales data from a
 * completely separate Supabase project (the OxiSure retention app).
 * This client is NEVER exposed to the browser — enforced by the
 * `server-only` import.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client connected to the OxiSure
 * retention app database. Read-only usage only.
 */
export function createOxiClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.OXISURE_SUPABASE_URL;
  const key = process.env.OXISURE_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing OXISURE_SUPABASE_URL or OXISURE_SUPABASE_SERVICE_KEY env vars. " +
        "Add them to .env.local for local dev or Vercel env vars for production."
    );
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}
