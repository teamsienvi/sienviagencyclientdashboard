import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Traffic classification: uses the canonical v2.2 classifier.
// Source of truth: supabase/functions/src/traffic-classifier.ts
import {
  classifyTraffic, rulesFromDbRow, CLASSIFIER_VERSION,
  type TrafficRules, type ClassificationResult,
} from "../src/traffic-classifier.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * backfill-traffic-audit (v2.1)
 *
 * Supports three actions:
 *   action = "backfill" (default) — classify/reclassify historical analytics
 *   action = "rollback"           — revert a specific audit run
 *
 * Backfill features:
 *   - Cursor-based pagination (resumable after failure)
 *   - Progress tracked in traffic_audit_runs
 *   - Dry-run produces zero mutations
 *   - Idempotent classification
 *   - Per-row history snapshots for deterministic rollback
 *
 * Rollback features:
 *   - Restores exact previous classification state per run
 *   - Detects conflicts with newer audit runs
 *   - Reports partial rollbacks when conflicts exist
 *   - Safe to retry
 *
 * Body params (backfill):
 *   clientId, dryRun?, batchSize?, runId?
 *
 * Body params (rollback):
 *   action: "rollback", runId: UUID
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

    let adminUserId: string | null = null;
    let adminEmail: string | null = null;

    // Parse body
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    // Allow service-role key for authenticated MACHINE DRY-RUN ONLY (never for browser or mutation)
    const isServiceRole = Boolean(supabaseKey && token === supabaseKey.trim());
    console.log('[backfill-auth]', { tokenLen: token.length, keyLen: supabaseKey?.length, isServiceRole, dryRun: body.dryRun });
    if (isServiceRole && body.dryRun === true) {
      adminUserId = 'service-role';
      adminEmail = 'service-role@system';
      console.log('Authenticated machine dry-run: authorized');
    } else if (isServiceRole && body.dryRun !== true) {
      return new Response(
        JSON.stringify({ error: 'Service-role key may only be used for dry-run. Production mutations require admin user JWT.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
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
      adminUserId = user.id;
      adminEmail = user.email || null;
    }

    const action = body.action || 'backfill';

    if (action === 'rollback') {
      if (adminUserId === 'service-role') {
        return new Response(
          JSON.stringify({ error: 'Service-role key may not execute rollback. Admin user JWT required.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await handleRollback(supabase, body, adminUserId, adminEmail);
    }

    return await handleBackfill(supabase, body, adminUserId, adminEmail);

  } catch (error) {
    console.error('Error in backfill-traffic-audit:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── BACKFILL HANDLER ────────────────────────────────────────────────

async function handleBackfill(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string | null,
  adminEmail: string | null,
) {
  const {
    clientId,
    dryRun = false,
    batchSize: requestedBatch = 1000,
    runId,
  } = body as { clientId?: string; dryRun?: boolean; batchSize?: number; runId?: string };

  if (!clientId) {
    return new Response(
      JSON.stringify({ error: 'clientId is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const batchSize = Math.min(Math.max(requestedBatch || 1000, 100), 1000);

  // Load traffic rules
  const { data: rulesRow } = await supabase
    .from('client_traffic_rules')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  const rules: TrafficRules | null = rulesRow ? rulesFromDbRow(rulesRow) : null;

  // Create or resume audit run
  let run: Record<string, unknown>;

  if (runId) {
    const { data: existing, error: fetchErr } = await supabase
      .from('traffic_audit_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return new Response(
        JSON.stringify({ error: 'Run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (existing.status === 'completed') {
      return new Response(
        JSON.stringify({ error: 'Run already completed', run: existing }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Verify client_id matches
    if (existing.client_id !== clientId) {
      return new Response(
        JSON.stringify({ error: 'Run belongs to a different client' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Resuming a failed/cancelled run is allowed even if the partial unique
    // index already has this row (it won't conflict because it's the same row).
    run = existing;
  } else {
    // ── Concurrent backfill protection (non-dry-run only) ─────────
    // Defense in depth: pre-check + partial unique index on DB.
    // The pre-check provides a clear error message.
    // The DB index prevents race conditions even if two requests pass pre-check.
    if (!dryRun) {
      const { data: activeRuns } = await supabase
        .from('traffic_audit_runs')
        .select('id, status, started_at, created_by')
        .eq('client_id', clientId)
        .eq('dry_run', false)
        .in('status', ['pending', 'running']);

      if (activeRuns && activeRuns.length > 0) {
        const active = activeRuns[0];
        return new Response(
          JSON.stringify({
            error: 'Another active backfill is already running for this client',
            conflict: {
              activeRunId: active.id,
              status: active.status,
              startedAt: active.started_at,
              createdBy: active.created_by,
            },
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: newRun, error: createErr } = await supabase
      .from('traffic_audit_runs')
      .insert({
        client_id: clientId,
        audit_version: CLASSIFIER_VERSION,
        dry_run: dryRun,
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: adminEmail || adminUserId || 'system',
        created_by_user_id: adminUserId,
      })
      .select()
      .single();

    if (createErr) {
      // Handle unique index violation (race condition between pre-check and insert)
      if (createErr.code === '23505' && createErr.message?.includes('idx_one_active_backfill_per_client')) {
        return new Response(
          JSON.stringify({
            error: 'Another active backfill is already running for this client (concurrent conflict)',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to create audit run: ${createErr.message}`);
    }
    if (!newRun) {
      throw new Error('Failed to create audit run: no data returned');
    }
    run = newRun;
  }

  await supabase
    .from('traffic_audit_runs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', run.id);

  const cursor = (run.cursor as string) || null;
  let totalScanned = (run.records_scanned as number) || 0;
  let totalChanged = (run.records_changed as number) || 0;
  let totalExcluded = (run.records_excluded as number) || 0;
  let totalIncluded = (run.records_included as number) || 0;

  const breakdown = {
    traffic_classes: {} as Record<string, number>,
    exclusion_policies: {} as Record<string, number>,
    would_exclude: 0,
    would_include: 0,
    geo_impact: 0,
  };

  // Per-table breakdown for independent PV/session reporting
  const perTable: Record<string, {
    scanned: number; changed: number; excluded: number; included: number;
    traffic_classes: Record<string, number>;
    exclusion_policies: Record<string, number>;
    would_exclude: number; would_include: number; geo_impact: number;
  }> = {};

  const ensureTable = (t: string) => {
    if (!perTable[t]) {
      perTable[t] = {
        scanned: 0, changed: 0, excluded: 0, included: 0,
        traffic_classes: {}, exclusion_policies: {},
        would_exclude: 0, would_include: 0, geo_impact: 0,
      };
    }
  };

  const addToBreakdown = (cls: ClassificationResult, table?: string) => {
    breakdown.traffic_classes[cls.traffic_class] =
      (breakdown.traffic_classes[cls.traffic_class] || 0) + 1;
    if (cls.exclusion_policy) {
      breakdown.exclusion_policies[cls.exclusion_policy] =
        (breakdown.exclusion_policies[cls.exclusion_policy] || 0) + 1;
    }
    if (table) {
      ensureTable(table);
      perTable[table].traffic_classes[cls.traffic_class] =
        (perTable[table].traffic_classes[cls.traffic_class] || 0) + 1;
      if (cls.exclusion_policy) {
        perTable[table].exclusion_policies[cls.exclusion_policy] =
          (perTable[table].exclusion_policies[cls.exclusion_policy] || 0) + 1;
      }
    }
  };

  // Process a table (page_views or sessions)
  async function processTable(tableName: string, recordType: string, startCursor: string | null) {
    let lastId = startCursor;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select('id, client_id, user_agent, country, ip_address, is_excluded, exclude_reason, traffic_class, traffic_flags, exclusion_policy, audit_version, evaluated_at')
        .eq('client_id', clientId)
        .order('id', { ascending: true })
        .limit(batchSize);

      if (lastId) query = query.gt('id', lastId);

      const { data: rows, error } = await query;
      if (error) {
        await supabase.from('traffic_audit_runs').update({
          status: 'failed',
          error_message: `${recordType} fetch error: ${error.message}`,
          updated_at: new Date().toISOString(),
          cursor: lastId ? `${recordType}:${lastId}` : null,
          records_scanned: totalScanned,
          records_changed: totalChanged,
        }).eq('id', run.id);
        throw error;
      }

      if (!rows || rows.length === 0) { hasMore = false; break; }

      totalScanned += rows.length;
      ensureTable(tableName);
      perTable[tableName].scanned += rows.length;
      const updates: { id: string; data: Record<string, unknown> }[] = [];
      const historyRows: Record<string, unknown>[] = [];

      for (const row of rows) {
        const cls = classifyTraffic({
          userAgent: row.user_agent || '',
          country: row.country || 'XX',
          ipAddress: row.ip_address,
          rules,
        });

        addToBreakdown(cls, tableName);

        // Detect actual changes
        const changed = cls.is_excluded !== row.is_excluded ||
          cls.traffic_class !== (row.traffic_class || 'unknown') ||
          cls.exclusion_policy !== (row.exclusion_policy || null);

        if (changed) {
          totalChanged++;
          perTable[tableName].changed++;
          if (cls.is_excluded && !row.is_excluded) {
            totalExcluded++;
            breakdown.would_exclude++;
            perTable[tableName].excluded++;
            perTable[tableName].would_exclude++;
          } else if (!cls.is_excluded && row.is_excluded) {
            totalIncluded++;
            breakdown.would_include++;
            perTable[tableName].included++;
            perTable[tableName].would_include++;
          }
          if (cls.exclusion_policy === 'geo_policy') {
            breakdown.geo_impact++;
            perTable[tableName].geo_impact++;
          }

          const newData = {
            is_excluded: cls.is_excluded,
            exclude_reason: cls.exclude_reason,
            traffic_class: cls.traffic_class,
            traffic_flags: cls.traffic_flags,
            exclusion_policy: cls.exclusion_policy,
            audit_version: cls.audit_version,
            evaluated_at: cls.evaluated_at,
          };

          updates.push({ id: row.id, data: newData });

          // Snapshot previous state for rollback
          historyRows.push({
            audit_run_id: run.id,
            client_id: clientId,
            record_type: recordType,
            record_id: row.id,
            previous_is_excluded: row.is_excluded,
            previous_exclude_reason: row.exclude_reason,
            previous_traffic_class: row.traffic_class,
            previous_traffic_flags: row.traffic_flags,
            previous_exclusion_policy: row.exclusion_policy,
            previous_audit_version: row.audit_version,
            previous_evaluated_at: row.evaluated_at,
            new_is_excluded: cls.is_excluded,
            new_exclude_reason: cls.exclude_reason,
            new_traffic_class: cls.traffic_class,
            new_traffic_flags: cls.traffic_flags,
            new_exclusion_policy: cls.exclusion_policy,
            new_audit_version: cls.audit_version,
            new_evaluated_at: cls.evaluated_at,
          });
        }
      }

      // Apply mutations (unless dry-run)
      if (!dryRun && updates.length > 0) {
        // Write history snapshots first
        if (historyRows.length > 0) {
          const { error: histErr } = await supabase
            .from('traffic_classification_history')
            .insert(historyRows);
          if (histErr) {
            console.error('History insert error:', histErr);
            // Non-fatal: continue with update but log the issue
          }
        }

        // Apply updates
        for (const u of updates) {
          await supabase
            .from(tableName)
            .update(u.data)
            .eq('id', u.id);
        }
      }

      lastId = rows[rows.length - 1].id;

      // Checkpoint cursor
      if (!dryRun) {
        await supabase.from('traffic_audit_runs').update({
          cursor: `${recordType}:${lastId}`,
          records_scanned: totalScanned,
          records_changed: totalChanged,
          records_excluded: totalExcluded,
          records_included: totalIncluded,
          updated_at: new Date().toISOString(),
        }).eq('id', run.id);
      }

      if (rows.length < batchSize) hasMore = false;
    }
  }

  // Parse checkpoint cursor if resuming
  let pvCursor: string | null = null;
  let sessionCursor: string | null = null;
  if (cursor) {
    const parts = cursor.split(':');
    const cType = parts[0];
    const cId = parts.slice(1).join(':');
    if (cType === 'page_view') {
      pvCursor = cId;
    } else if (cType === 'session') {
      pvCursor = 'DONE';
      sessionCursor = cId;
    }
  }

  // Process page views, then sessions
  if (pvCursor !== 'DONE') {
    await processTable('web_analytics_page_views', 'page_view', pvCursor);
  }
  await processTable('web_analytics_sessions', 'session', sessionCursor);

  // Complete the run
  const finalStats = {
    records_scanned: totalScanned,
    records_changed: totalChanged,
    records_excluded: totalExcluded,
    records_included: totalIncluded,
    breakdown,
    page_views: perTable['web_analytics_page_views'] || null,
    sessions: perTable['web_analytics_sessions'] || null,
  };

  await supabase.from('traffic_audit_runs').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    records_scanned: totalScanned,
    records_changed: dryRun ? 0 : totalChanged,
    records_excluded: totalExcluded,
    records_included: totalIncluded,
    run_stats: finalStats,
  }).eq('id', run.id);

  console.log(`Backfill ${dryRun ? '(dry-run) ' : ''}complete:`, JSON.stringify(finalStats, null, 2));

  return new Response(
    JSON.stringify({
      success: true,
      dryRun,
      runId: run.id,
      auditVersion: CLASSIFIER_VERSION,
      stats: finalStats,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ── ROLLBACK HANDLER ────────────────────────────────────────────────

async function handleRollback(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  adminUserId: string | null,
  adminEmail: string | null,
) {
  const { runId } = body as { runId?: string };

  if (!runId) {
    return new Response(
      JSON.stringify({ error: 'runId is required for rollback' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Load the audit run
  const { data: run, error: runErr } = await supabase
    .from('traffic_audit_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();

  if (runErr || !run) {
    return new Response(
      JSON.stringify({ error: 'Audit run not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (run.dry_run) {
    return new Response(
      JSON.stringify({ error: 'Cannot rollback a dry-run (no mutations were made)' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (['rolled_back', 'pending'].includes(run.status)) {
    return new Response(
      JSON.stringify({ error: `Run status is ${run.status}, cannot rollback` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Load all history rows for this run
  const { data: historyRows, error: histErr } = await supabase
    .from('traffic_classification_history')
    .select('*')
    .eq('audit_run_id', runId)
    .order('created_at', { ascending: true });

  if (histErr) throw histErr;

  if (!historyRows || historyRows.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No classification history found for this run', runId }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let restored = 0;
  let conflicts = 0;
  let skipped = 0;
  const conflictDetails: { recordId: string; recordType: string; reason: string }[] = [];

  for (const hist of historyRows) {
    const tableName = hist.record_type === 'page_view'
      ? 'web_analytics_page_views'
      : 'web_analytics_sessions';

    // Fetch current state of the record
    const { data: currentRow } = await supabase
      .from(tableName)
      .select('audit_version, evaluated_at')
      .eq('id', hist.record_id)
      .maybeSingle();

    if (!currentRow) {
      skipped++;
      continue;
    }

    // Conflict detection: if a newer audit run has modified this record
    // after our target run, do NOT silently overwrite it
    if (currentRow.audit_version !== hist.new_audit_version ||
        (currentRow.evaluated_at && hist.new_evaluated_at &&
         new Date(currentRow.evaluated_at).getTime() > new Date(hist.new_evaluated_at).getTime())) {
      conflicts++;
      conflictDetails.push({
        recordId: hist.record_id,
        recordType: hist.record_type,
        reason: `Record was modified by a newer audit (current: ${currentRow.audit_version}, expected: ${hist.new_audit_version})`,
      });
      continue;
    }

    // Restore previous state
    const { error: updateErr } = await supabase
      .from(tableName)
      .update({
        is_excluded: hist.previous_is_excluded,
        exclude_reason: hist.previous_exclude_reason,
        traffic_class: hist.previous_traffic_class,
        traffic_flags: hist.previous_traffic_flags,
        exclusion_policy: hist.previous_exclusion_policy,
        audit_version: hist.previous_audit_version,
        evaluated_at: hist.previous_evaluated_at,
      })
      .eq('id', hist.record_id);

    if (updateErr) {
      console.error(`Rollback update failed for ${hist.record_type} ${hist.record_id}:`, updateErr);
      conflicts++;
      conflictDetails.push({
        recordId: hist.record_id,
        recordType: hist.record_type,
        reason: `Update failed: ${updateErr.message}`,
      });
    } else {
      restored++;
    }
  }

  // Determine rollback status
  let rollbackStatus: string;
  if (conflicts === 0 && restored > 0) {
    rollbackStatus = 'rolled_back';
  } else if (restored > 0 && conflicts > 0) {
    rollbackStatus = 'rollback_partial';
  } else if (restored === 0 && conflicts > 0) {
    rollbackStatus = 'rollback_failed';
  } else {
    rollbackStatus = 'rolled_back';
  }

  // Update run status
  await supabase
    .from('traffic_audit_runs')
    .update({
      status: rollbackStatus,
      updated_at: new Date().toISOString(),
      run_stats: {
        ...(run.run_stats || {}),
        rollback: {
          restored,
          conflicts,
          skipped,
          conflictDetails: conflictDetails.slice(0, 50),
          rolled_back_by: adminEmail || adminUserId || 'system',
          rolled_back_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', runId);

  console.log(`Rollback ${rollbackStatus}: restored=${restored}, conflicts=${conflicts}, skipped=${skipped}`);

  return new Response(
    JSON.stringify({
      success: rollbackStatus !== 'rollback_failed',
      runId,
      status: rollbackStatus,
      restored,
      conflicts,
      skipped,
      conflictDetails: conflictDetails.slice(0, 20),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
