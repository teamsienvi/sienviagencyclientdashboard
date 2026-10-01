// Admin UI for Traffic Classification v2.2
// Classification source of truth: supabase/functions/src/traffic-classifier.ts
// Rule mutations go through: supabase/functions/update-traffic-rules/index.ts
// Backfill/rollback: supabase/functions/backfill-traffic-audit/index.ts
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { THRESHOLDS } from "@/lib/traffic-thresholds";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Shield, ShieldAlert, ShieldCheck, Bot, Globe, Wifi, Loader2,
  Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle2,
  Eye, EyeOff, Users, HelpCircle, Activity, History,
} from "lucide-react";
import { format } from "date-fns";

// ── Country list ────────────────────────────────────────────────────
const COMMON_COUNTRIES = [
  { code: "US", name: "United States" }, { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" }, { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
  { code: "IN", name: "India" }, { code: "PH", name: "Philippines" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" }, { code: "KR", name: "South Korea" },
  { code: "NZ", name: "New Zealand" }, { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" }, { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" }, { code: "IE", name: "Ireland" },
  { code: "NL", name: "Netherlands" }, { code: "SE", name: "Sweden" },
  { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" },
];

const getFlag = (code: string) => {
  if (!code || code.length !== 2) return "🌐";
  try {
    return String.fromCodePoint(
      ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch { return "🌐"; }
};

/** Mask IP for display: 192.168.1.xxx */
const maskIp = (ip: string | null): string => {
  if (!ip) return "—";
  const parts = ip.trim().split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  return ip.trim().slice(0, -3) + "xxx";
};

// Thresholds imported from shared single source of truth
// See: supabase/functions/src/traffic-thresholds.ts

type GeoMode = "off" | "observe" | "exclude";

interface TrafficRulesRow {
  id: string;
  client_id: string;
  allowed_countries: string[] | null;
  team_ips: string[] | null;
  custom_bot_patterns: string[] | null;
  is_active: boolean;
  updated_at: string;
  geo_mode: GeoMode;
  allowed_ips: string[] | null;
  allowed_cidrs: string[] | null;
  allowed_ua_patterns: string[] | null;
}

// ── Main component ──────────────────────────────────────────────────
export function TrafficAuditPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const [newIp, setNewIp] = useState("");
  const [newBotPattern, setNewBotPattern] = useState("");
  const [newAllowIp, setNewAllowIp] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");

  // ── Fetch rules ───────────────────────────────────────────────────
  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["traffic-rules", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_traffic_rules" as any)
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as TrafficRulesRow | null;
    },
    enabled: !!clientId,
  });

  // ── Fetch reconciled stats ────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["traffic-audit-stats", clientId],
    queryFn: async () => {
      // Raw totals
      const { count: rawPv } = await supabase
        .from("web_analytics_page_views" as any)
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);

      const { count: excludedPv } = await supabase
        .from("web_analytics_page_views" as any)
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("is_excluded", true);

      const { count: rawSess } = await supabase
        .from("web_analytics_sessions" as any)
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);

      const { count: excludedSess } = await supabase
        .from("web_analytics_sessions" as any)
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("is_excluded", true);

      // Traffic class breakdown (from sessions for cleaner numbers)
      const { data: classRows } = await supabase
        .from("web_analytics_sessions" as any)
        .select("traffic_class, is_excluded, exclusion_policy")
        .eq("client_id", clientId);

      const classCounts: Record<string, number> = {};
      const policyCounts: Record<string, number> = {};
      (classRows || []).forEach((r: any) => {
        const cls = r.traffic_class || "unknown";
        classCounts[cls] = (classCounts[cls] || 0) + 1;
        if (r.is_excluded && r.exclusion_policy) {
          policyCounts[r.exclusion_policy] = (policyCounts[r.exclusion_policy] || 0) + 1;
        }
      });

      // Recent excluded entries
      const { data: recentExcluded } = await supabase
        .from("web_analytics_page_views" as any)
        .select("id, page_url, country, user_agent, exclude_reason, traffic_class, exclusion_policy, viewed_at, ip_address")
        .eq("client_id", clientId)
        .eq("is_excluded", true)
        .order("viewed_at", { ascending: false })
        .limit(20);

      return {
        rawPv: rawPv || 0,
        excludedPv: excludedPv || 0,
        reportingPv: (rawPv || 0) - (excludedPv || 0),
        rawSess: rawSess || 0,
        excludedSess: excludedSess || 0,
        reportingSess: (rawSess || 0) - (excludedSess || 0),
        classCounts,
        policyCounts,
        recentExcluded: recentExcluded || [],
      };
    },
    enabled: !!clientId,
    staleTime: 30_000,
  });

  // ── Fetch recent audit runs ───────────────────────────────────────
  const { data: recentRuns } = useQuery({
    queryKey: ["traffic-audit-runs", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("traffic_audit_runs" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Mutations ─────────────────────────────────────────────────────
  // Rule mutations go through a trusted server-side edge function.
  // Identity is resolved from the JWT server-side, never from the browser.
  const upsertRules = useMutation({
    mutationFn: async (updates: Partial<TrafficRulesRow>) => {
      const { data, error } = await supabase.functions.invoke("update-traffic-rules", {
        body: { clientId, updates },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rules", clientId] });
    },
  });

  const runBackfill = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke("backfill-traffic-audit", {
        body: { clientId, dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-audit-stats", clientId] });
      qc.invalidateQueries({ queryKey: ["traffic-audit-runs", clientId] });
    },
  });

  const rollbackRun = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke("backfill-traffic-audit", {
        body: { action: "rollback", runId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-audit-stats", clientId] });
      qc.invalidateQueries({ queryKey: ["traffic-audit-runs", clientId] });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const setGeoMode = (mode: GeoMode) => {
    upsertRules.mutate({ geo_mode: mode } as any);
  };

  const addCountry = () => {
    if (!selectedCountry) return;
    const current = rules?.allowed_countries || [];
    if (current.includes(selectedCountry)) return;
    upsertRules.mutate({ allowed_countries: [...current, selectedCountry] } as any);
    setSelectedCountry("");
  };

  const removeCountry = (code: string) => {
    const current = rules?.allowed_countries || [];
    upsertRules.mutate({ allowed_countries: current.filter((c) => c !== code) } as any);
  };

  const addTeamIp = () => {
    const ip = newIp.trim();
    if (!ip) return;
    const current = rules?.team_ips || [];
    if (current.includes(ip)) return;
    upsertRules.mutate({ team_ips: [...current, ip] } as any);
    setNewIp("");
  };

  const removeTeamIp = (ip: string) => {
    const current = rules?.team_ips || [];
    upsertRules.mutate({ team_ips: current.filter((i) => i !== ip) } as any);
  };

  const addBotPattern = () => {
    const pattern = newBotPattern.trim().toLowerCase();
    if (!pattern) return;
    const current = rules?.custom_bot_patterns || [];
    if (current.includes(pattern)) return;
    upsertRules.mutate({ custom_bot_patterns: [...current, pattern] } as any);
    setNewBotPattern("");
  };

  const removeBotPattern = (pattern: string) => {
    const current = rules?.custom_bot_patterns || [];
    upsertRules.mutate({ custom_bot_patterns: current.filter((p) => p !== pattern) } as any);
  };

  const addAllowIp = () => {
    const ip = newAllowIp.trim();
    if (!ip) return;
    const current = rules?.allowed_ips || [];
    if (current.includes(ip)) return;
    upsertRules.mutate({ allowed_ips: [...current, ip] } as any);
    setNewAllowIp("");
  };

  const removeAllowIp = (ip: string) => {
    const current = rules?.allowed_ips || [];
    upsertRules.mutate({ allowed_ips: current.filter((i) => i !== ip) } as any);
  };

  const getClassIcon = (cls: string) => {
    switch (cls) {
      case "bot": return <Bot className="h-3 w-3" />;
      case "internal": return <Wifi className="h-3 w-3" />;
      case "suspicious": return <AlertTriangle className="h-3 w-3" />;
      case "human": return <Users className="h-3 w-3" />;
      default: return <HelpCircle className="h-3 w-3" />;
    }
  };

  const getClassColor = (cls: string) => {
    switch (cls) {
      case "bot": return "text-red-600 bg-red-500/10";
      case "internal": return "text-blue-600 bg-blue-500/10";
      case "suspicious": return "text-amber-600 bg-amber-500/10";
      case "human": return "text-green-600 bg-green-500/10";
      default: return "text-gray-500 bg-gray-500/10";
    }
  };

  const getPolicyBadge = (policy: string | null) => {
    if (!policy) return null;
    const labels: Record<string, { label: string; color: string }> = {
      known_bot: { label: "Known Bot", color: "text-red-600 bg-red-500/10" },
      custom_bot: { label: "Custom Bot", color: "text-red-600 bg-red-500/10" },
      internal_traffic: { label: "Internal", color: "text-blue-600 bg-blue-500/10" },
      geo_policy: { label: "Geo Policy", color: "text-amber-600 bg-amber-500/10" },
      suspicious_automation: { label: "Suspicious", color: "text-orange-600 bg-orange-500/10" },
    };
    const cfg = labels[policy] || { label: policy, color: "text-gray-500 bg-gray-500/10" };
    return <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>;
  };

  // ── Computed values ───────────────────────────────────────────────
  const exclusionRate = stats && stats.rawSess > 0
    ? ((stats.excludedSess / stats.rawSess) * 100)
    : 0;
  const highExclusionWarning = exclusionRate > THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING * 100;
  const geoMode = (rules?.geo_mode as GeoMode) || "observe";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <Shield className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Traffic Classification</h2>
            <p className="text-sm text-muted-foreground">
              {clientName} — analytics data quality layer
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runBackfill.mutate(true)} disabled={runBackfill.isPending}>
            {runBackfill.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            Dry Run
          </Button>
          <Button size="sm" onClick={() => runBackfill.mutate(false)} disabled={runBackfill.isPending}
            className="bg-amber-600 hover:bg-amber-700">
            {runBackfill.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Run Backfill
          </Button>
        </div>
      </div>

      {/* Exclusion rate warning */}
      {highExclusionWarning && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 px-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">High Exclusion Rate: {exclusionRate.toFixed(1)}%</p>
              <p className="text-muted-foreground mt-0.5">
                More than {(THRESHOLDS.DEFAULT_EXCLUSION_RATE_WARNING * 100).toFixed(0)}% of sessions are excluded. Review your rules to ensure legitimate traffic isn't being filtered.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backfill result */}
      {runBackfill.data && (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="py-3 px-4 flex items-start gap-2">
            {runBackfill.data.dryRun
              ? <Eye className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              : <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />}
            <div className="text-sm">
              <p className="font-medium">{runBackfill.data.dryRun ? "Dry Run Complete" : "Backfill Complete"}</p>
              <p className="text-muted-foreground mt-1">
                Scanned: {runBackfill.data.stats.records_scanned.toLocaleString()} •
                Changed: <span className="font-medium">{runBackfill.data.stats.records_changed.toLocaleString()}</span> •
                Would exclude: <span className="text-red-500">{runBackfill.data.stats.breakdown.would_exclude.toLocaleString()}</span> •
                Would include: <span className="text-green-500">{runBackfill.data.stats.breakdown.would_include.toLocaleString()}</span>
                {runBackfill.data.stats.breakdown.geo_impact > 0 && (
                  <> • Geo impact: <span className="text-amber-500">{runBackfill.data.stats.breakdown.geo_impact.toLocaleString()}</span></>
                )}
              </p>
              {runBackfill.data.stats.breakdown.traffic_classes && Object.keys(runBackfill.data.stats.breakdown.traffic_classes).length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {Object.entries(runBackfill.data.stats.breakdown.traffic_classes as Record<string, number>).map(([cls, count]) => (
                    <Badge key={cls} variant="secondary" className={`text-xs gap-1 ${getClassColor(cls)}`}>
                      {getClassIcon(cls)} {cls}: {(count as number).toLocaleString()}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Reconciliation ─────────────────────────────────────── */}
      <div className="grid gap-px bg-border rounded-xl overflow-hidden" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {/* Sessions reconciliation */}
        <Card className="rounded-none border-0">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Raw</span>
              <span className="font-semibold tabular-nums">{stats?.rawSess?.toLocaleString() || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-600 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Reporting</span>
              <span className="font-semibold text-green-600 tabular-nums">{stats?.reportingSess?.toLocaleString() || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-500 flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Excluded</span>
              <span className="font-semibold text-red-500 tabular-nums">{stats?.excludedSess?.toLocaleString() || "0"}</span>
            </div>
            {exclusionRate > 0 && (
              <div className="pt-1 border-t">
                <span className="text-xs text-muted-foreground">Exclusion rate: </span>
                <span className={`text-xs font-medium ${highExclusionWarning ? "text-amber-500" : ""}`}>
                  {exclusionRate.toFixed(1)}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Page views reconciliation */}
        <Card className="rounded-none border-0">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm tracking-wide text-muted-foreground uppercase flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> Page Views
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Raw</span>
              <span className="font-semibold tabular-nums">{stats?.rawPv?.toLocaleString() || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-600 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Reporting</span>
              <span className="font-semibold text-green-600 tabular-nums">{stats?.reportingPv?.toLocaleString() || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-500 flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Excluded</span>
              <span className="font-semibold text-red-500 tabular-nums">{stats?.excludedPv?.toLocaleString() || "0"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Traffic Class & Policy Breakdown ────────────────────────── */}
      {stats && (Object.keys(stats.classCounts).length > 0 || Object.keys(stats.policyCounts).length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Traffic class breakdown */}
          {Object.keys(stats.classCounts).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Traffic Classification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {Object.entries(stats.classCounts).sort((a, b) => b[1] - a[1]).map(([cls, count]) => (
                    <div key={cls} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <Badge variant="secondary" className={`text-xs gap-1 ${getClassColor(cls)}`}>
                          {getClassIcon(cls)} {cls}
                        </Badge>
                      </span>
                      <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exclusion policy breakdown */}
          {Object.keys(stats.policyCounts).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Exclusion Policy Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {Object.entries(stats.policyCounts).sort((a, b) => b[1] - a[1]).map(([policy, count]) => (
                    <div key={policy} className="flex items-center justify-between text-sm">
                      {getPolicyBadge(policy)}
                      <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm pt-1 border-t">
                    <span className="font-medium text-muted-foreground">Total Excluded</span>
                    <span className="font-semibold tabular-nums">
                      {Object.values(stats.policyCounts).reduce((a, b) => a + b, 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Rules Configuration ────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Reporting Policy Configuration</h3>

        {/* Geo Policy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4 text-amber-500" />
              Geographic Reporting Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode selector */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Mode</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "off" as GeoMode, label: "Off", desc: "No geographic filtering", icon: <EyeOff className="h-4 w-4" /> },
                  { value: "observe" as GeoMode, label: "Observe", desc: "Flag but include in reporting", icon: <Eye className="h-4 w-4" /> },
                  { value: "exclude" as GeoMode, label: "Exclude", desc: "Remove from reporting KPIs", icon: <ShieldAlert className="h-4 w-4" /> },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGeoMode(opt.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      geoMode === opt.value
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {opt.icon}
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {geoMode === "observe" && (
                <p className="text-xs text-muted-foreground italic mt-1">
                  Visitors outside target countries are identified but remain included in reporting.
                </p>
              )}
              {geoMode === "exclude" && (
                <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-1">
                  ⚠ Visitors outside target countries are preserved in raw analytics but removed from reporting KPIs.
                </p>
              )}
            </div>

            {/* Target countries */}
            {geoMode !== "off" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Target Countries</p>
                <div className="flex flex-wrap gap-1.5">
                  {(rules?.allowed_countries || []).map((code) => (
                    <Badge key={code} variant="secondary"
                      className="text-xs gap-1 pr-1 hover:bg-destructive/10 cursor-pointer group"
                      onClick={() => removeCountry(code)}>
                      {getFlag(code)} {code}
                      <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive transition-opacity" />
                    </Badge>
                  ))}
                  {(!rules?.allowed_countries || rules.allowed_countries.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No target countries configured (all included)</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Add country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_COUNTRIES
                        .filter((c) => !(rules?.allowed_countries || []).includes(c.code))
                        .map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {getFlag(c.code)} {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8" onClick={addCountry} disabled={!selectedCountry}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team IPs, Custom Bots, Allowlist */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Team IPs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="h-4 w-4 text-blue-500" />
                Team / VPN IPs
              </CardTitle>
              <CardDescription className="text-xs">
                Exclude internal traffic. Supports CIDR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(rules?.team_ips || []).map((ip) => (
                  <Badge key={ip} variant="outline"
                    className="text-xs gap-1 pr-1 hover:bg-destructive/10 cursor-pointer group font-mono"
                    onClick={() => removeTeamIp(ip)}>
                    {ip}
                    <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive transition-opacity" />
                  </Badge>
                ))}
                {(!rules?.team_ips || rules.team_ips.length === 0) && (
                  <p className="text-xs text-muted-foreground italic">No team IPs</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="IP or CIDR..."
                  className="h-8 text-xs font-mono flex-1" onKeyDown={(e) => e.key === "Enter" && addTeamIp()} />
                <Button size="sm" variant="outline" className="h-8" onClick={addTeamIp} disabled={!newIp.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Custom bots */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-red-500" />
                Custom Bot Patterns
              </CardTitle>
              <CardDescription className="text-xs">
                Extra UA substrings (50+ built-in active).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(rules?.custom_bot_patterns || []).map((p) => (
                  <Badge key={p} variant="destructive"
                    className="text-xs gap-1 pr-1 cursor-pointer group font-mono bg-red-500/10 text-red-600 hover:bg-red-500/20"
                    onClick={() => removeBotPattern(p)}>
                    {p}
                    <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Badge>
                ))}
                {(!rules?.custom_bot_patterns || rules.custom_bot_patterns.length === 0) && (
                  <p className="text-xs text-muted-foreground italic">Built-in only</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={newBotPattern} onChange={(e) => setNewBotPattern(e.target.value)} placeholder="UA substring..."
                  className="h-8 text-xs font-mono flex-1" onKeyDown={(e) => e.key === "Enter" && addBotPattern()} />
                <Button size="sm" variant="outline" className="h-8" onClick={addBotPattern} disabled={!newBotPattern.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Allowlist */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                IP Allowlist
              </CardTitle>
              <CardDescription className="text-xs">
                Include in reporting regardless of classification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(rules?.allowed_ips || []).map((ip) => (
                  <Badge key={ip} variant="outline"
                    className="text-xs gap-1 pr-1 hover:bg-destructive/10 cursor-pointer group font-mono border-green-500/40 text-green-600"
                    onClick={() => removeAllowIp(ip)}>
                    {ip}
                    <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive transition-opacity" />
                  </Badge>
                ))}
                {(!rules?.allowed_ips || rules.allowed_ips.length === 0) && (
                  <p className="text-xs text-muted-foreground italic">No allowlisted IPs</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={newAllowIp} onChange={(e) => setNewAllowIp(e.target.value)} placeholder="IP to allow..."
                  className="h-8 text-xs font-mono flex-1" onKeyDown={(e) => e.key === "Enter" && addAllowIp()} />
                <Button size="sm" variant="outline" className="h-8" onClick={addAllowIp} disabled={!newAllowIp.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Recent Audit Runs ──────────────────────────────────────── */}
      {recentRuns && recentRuns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Recent Audit Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Version</TableHead>
                    <TableHead className="text-xs">Scanned</TableHead>
                    <TableHead className="text-xs">Changed</TableHead>
                    <TableHead className="text-xs">Started</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((run: any) => (
                    <TableRow key={run.id} className="text-xs">
                      <TableCell>
                        <Badge variant={run.status === "completed" ? "secondary" : run.status === "failed" ? "destructive" : "outline"}
                          className="text-xs">
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{run.dry_run ? "Dry run" : "Backfill"}</TableCell>
                      <TableCell className="font-mono">{run.audit_version}</TableCell>
                      <TableCell className="tabular-nums">{run.records_scanned?.toLocaleString() || 0}</TableCell>
                      <TableCell className="tabular-nums">{run.records_changed?.toLocaleString() || 0}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {run.started_at ? format(new Date(run.started_at), "MMM d, HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        {run.status === "completed" && !run.dry_run && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs text-amber-600 hover:text-amber-700"
                            onClick={() => {
                              if (window.confirm(`Rollback audit run ${run.id.slice(0, 8)}? This will restore previous classification state.`)) {
                                rollbackRun.mutate(run.id);
                              }
                            }}
                            disabled={rollbackRun.isPending}
                          >
                            {rollbackRun.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Rollback"}
                          </Button>
                        )}
                        {["rolled_back", "rollback_partial", "rollback_failed"].includes(run.status) && (
                          <span className="text-muted-foreground italic">{run.status}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Excluded Traffic ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Excluded Traffic</CardTitle>
          <CardDescription className="text-xs">
            Preserved in raw analytics, hidden from reporting KPIs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !stats?.recentExcluded || stats.recentExcluded.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No excluded traffic recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[80px]">Class</TableHead>
                    <TableHead className="text-xs w-[100px]">Policy</TableHead>
                    <TableHead className="text-xs">Page</TableHead>
                    <TableHead className="text-xs w-[50px]">Geo</TableHead>
                    <TableHead className="text-xs w-[110px]">IP</TableHead>
                    <TableHead className="text-xs w-[130px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentExcluded.map((row: any) => (
                    <TableRow key={row.id} className="text-xs">
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs gap-1 ${getClassColor(row.traffic_class || "unknown")}`}>
                          {getClassIcon(row.traffic_class || "unknown")} {row.traffic_class || "?"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getPolicyBadge(row.exclusion_policy || row.exclude_reason?.split(":")[0])}</TableCell>
                      <TableCell className="font-mono truncate max-w-[180px]" title={row.page_url}>{row.page_url}</TableCell>
                      <TableCell>{row.country ? `${getFlag(row.country)} ${row.country}` : "—"}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{maskIp(row.ip_address)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {row.viewed_at ? format(new Date(row.viewed_at), "MMM d, HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
