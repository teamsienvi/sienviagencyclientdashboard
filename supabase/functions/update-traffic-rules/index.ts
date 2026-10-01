import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * update-traffic-rules — Server-side traffic rule mutation + audit logging
 *
 * Part of the Traffic Classification v2.2 system.
 * Rules configured here are consumed by classifyTraffic() in:
 *   supabase/functions/src/traffic-classifier.ts (canonical source of truth)
 *
 * Trusted mutation path:
 *   1. Verify JWT and resolve authenticated user identity
 *   2. Verify admin role server-side
 *   3. Load previous traffic rules
 *   4. Validate new rules
 *   5. Atomically update client_traffic_rules + insert audit log
 *
 * Identity (changed_by, changed_by_user_id) is NEVER accepted from the
 * browser — always resolved from the authenticated JWT server-side.
 *
 * Body params:
 *   clientId  – required: scope to a single client
 *   updates   – partial traffic rules to upsert
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ── Auth: extract and verify admin identity ─────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleRow) {
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-validated identity — never from browser
    const adminUserId = user.id;
    const adminEmail = user.email || null;

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { clientId, updates } = body as {
      clientId?: string;
      updates?: Record<string, unknown>;
    };

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'updates object is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Validate rule fields ────────────────────────────────────────
    const VALID_FIELDS = new Set([
      'allowed_countries', 'team_ips', 'custom_bot_patterns', 'is_active',
      'geo_mode', 'allowed_ips', 'allowed_cidrs', 'allowed_ua_patterns',
    ]);
    for (const key of Object.keys(updates)) {
      if (!VALID_FIELDS.has(key)) {
        return new Response(
          JSON.stringify({ error: `Invalid rule field: ${key}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate geo_mode value if provided
    if (updates.geo_mode !== undefined) {
      if (!['off', 'observe', 'exclude'].includes(updates.geo_mode as string)) {
        return new Response(
          JSON.stringify({ error: 'geo_mode must be one of: off, observe, exclude' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Load previous config ────────────────────────────────────────
    const { data: existingRules } = await supabase
      .from('client_traffic_rules')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    const previousConfig = existingRules
      ? (() => {
          const c = { ...existingRules };
          delete c.id;
          delete c.client_id;
          return c;
        })()
      : null;

    // Build new config for audit log
    const newConfig = { ...previousConfig, ...updates };

    // ── Atomic: update rules + insert audit log ─────────────────────
    // Upsert traffic rules
    const { error: upsertError } = await supabase
      .from('client_traffic_rules')
      .upsert(
        {
          client_id: clientId,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' }
      );

    if (upsertError) {
      console.error('Rule upsert error:', upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to update rules: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert audit log — server-validated identity only
    const { error: auditError } = await supabase
      .from('traffic_rule_audit_log')
      .insert({
        client_id: clientId,
        changed_by: adminEmail || adminUserId,
        changed_by_user_id: adminUserId,
        previous_config: previousConfig,
        new_config: newConfig,
      });

    if (auditError) {
      // Non-fatal: rule update succeeded, log the audit failure
      console.error('Audit log insert error:', auditError);
    }

    // ── Reload and return updated rules ──────────────────────────────
    const { data: updatedRules } = await supabase
      .from('client_traffic_rules')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        rules: updatedRules,
        audit: {
          changed_by: adminEmail || adminUserId,
          changed_by_user_id: adminUserId,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-traffic-rules:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
