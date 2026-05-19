"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList, CheckCircle2, Circle,
  ChevronLeft, ChevronRight, Users, Globe, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── constants ─────────────────────────────────────────────────────────────────

/** Max action items shown per client across all types */
const MAX_ITEMS_PER_CLIENT = 3;

// ── types ─────────────────────────────────────────────────────────────────────

interface ActionItem {
  text: string;
  type: "social" | "website";
}

interface ClientWeekSummary {
  clientId: string;
  clientName: string;
  logoUrl: string | null;
  items: ActionItem[];
}

function itemKey(clientId: string, index: number) {
  return `${clientId}::${index}`;
}

// ── ActionRow ─────────────────────────────────────────────────────────────────

function ActionRow({
  item, done, onToggle,
}: { item: ActionItem; done: boolean; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);

  // Truncate to ~100 chars unless expanded
  const isLong = item.text.length > 100;
  const displayText = isLong && !expanded ? item.text.slice(0, 100).trimEnd() + "…" : item.text;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors group",
        done ? "opacity-50" : "hover:bg-muted/40"
      )}
    >
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0">
        {done
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <Circle className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
        }
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          {item.type === "social"
            ? <Users className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
            : <Globe className="w-2.5 h-2.5 text-sky-400 flex-shrink-0" />
          }
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            item.type === "social" ? "text-violet-400" : "text-sky-400"
          )}>
            {item.type}
          </span>
        </div>
        <p className={cn("text-xs leading-relaxed", done && "line-through text-muted-foreground")}>
          {displayText}
          {isLong && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="ml-1 text-primary/60 hover:text-primary text-[10px] font-medium"
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </p>
      </div>
    </div>
  );
}

// ── ClientCard ────────────────────────────────────────────────────────────────

function ClientCard({
  summary, status, onToggle,
}: {
  summary: ClientWeekSummary;
  status: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const total = summary.items.length;
  const doneCount = summary.items.filter((_, i) => status[itemKey(summary.clientId, i)]).length;
  const allDone = total > 0 && doneCount === total;

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all",
      allDone ? "border-emerald-500/30 bg-emerald-50/5" : "border-border/50"
    )}>
      {/* Client header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/30">
        {summary.logoUrl ? (
          <img src={summary.logoUrl} alt={summary.clientName}
            className="w-6 h-6 rounded-md object-cover ring-1 ring-border flex-shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary">
            {summary.clientName[0]}
          </div>
        )}
        <span className="font-semibold text-xs truncate flex-1">{summary.clientName}</span>
        <span className={cn(
          "text-[10px] font-medium flex-shrink-0 tabular-nums",
          allDone ? "text-emerald-500" : "text-muted-foreground"
        )}>
          {doneCount}/{total}
        </span>
      </div>

      {/* Items */}
      <div className="py-1.5 space-y-0.5">
        {total === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-3">No actions this week</p>
        ) : (
          summary.items.map((item, i) => (
            <ActionRow
              key={i}
              item={item}
              done={!!status[itemKey(summary.clientId, i)]}
              onToggle={() => onToggle(itemKey(summary.clientId, i))}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── main modal ────────────────────────────────────────────────────────────────

export function WeeklyReviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [weekIndex, setWeekIndex] = useState(0); // 0 = most recent

  // ── fetch all summaries ────────────────────────────────────────────────────

  const { data: rawSummaries = [], isLoading } = useQuery({
    queryKey: ["weekly-review-raw"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_summaries")
        .select("client_id, type, period_start, period_end, generated_at, summary_data, clients(id, name, logo_url)")
        .in("type", ["social", "website"])
        .order("generated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // ── derive available weeks (must come before status query) ──────────────────

  const availableWeeks = useMemo(() => {
    const seen = new Set<string>();
    const weeks: { start: string; end: string }[] = [];
    for (const row of rawSummaries) {
      const key = row.period_start;
      if (!seen.has(key)) {
        seen.add(key);
        weeks.push({ start: row.period_start, end: row.period_end });
      }
    }
    return weeks;
  }, [rawSummaries]);

  const selectedWeek = availableWeeks[weekIndex] ?? null;

  // ── fetch shared status from Supabase ─────────────────────────────────────

  const statusQueryKey = ["weekly-review-status", selectedWeek?.start];

  const { data: statusData } = useQuery<Record<string, boolean>>({
    queryKey: statusQueryKey,
    enabled: open && !!selectedWeek,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_review_status" as any)
        .select("status_json")
        .eq("period_start", selectedWeek!.start)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.status_json ?? {}) as Record<string, boolean>;
    },
  });

  const status: Record<string, boolean> = statusData ?? {};

  const handleToggle = async (key: string) => {
    const next = { ...status, [key]: !status[key] };
    queryClient.setQueryData(statusQueryKey, next);
    await supabase
      .from("weekly_review_status" as any)
      .upsert({ period_start: selectedWeek!.start, status_json: next, updated_at: new Date().toISOString() },
        { onConflict: "period_start" });
  };

  const handleReset = async () => {
    queryClient.setQueryData(statusQueryKey, {});
    await supabase
      .from("weekly_review_status" as any)
      .upsert({ period_start: selectedWeek!.start, status_json: {}, updated_at: new Date().toISOString() },
        { onConflict: "period_start" });
  };

  // ── build per-client summaries for selected week ──────────────────────────

  const summaries: ClientWeekSummary[] = useMemo(() => {
    if (!selectedWeek) return [];

    // Filter rows for this week only
    const weekRows = rawSummaries.filter(r => r.period_start === selectedWeek.start);

    // Group by client: collect social + website actions
    const clientMap: Record<string, {
      clientName: string; logoUrl: string | null;
      social: string[]; website: string[];
    }> = {};

    for (const row of weekRows) {
      const cId = row.client_id;
      const client = row.clients as any;
      if (!clientMap[cId]) {
        clientMap[cId] = { clientName: client?.name ?? cId, logoUrl: client?.logo_url ?? null, social: [], website: [] };
      }
      const actions: string[] = (row.summary_data as any)?.smartActions ?? [];
      if (row.type === "social" && clientMap[cId].social.length === 0) clientMap[cId].social = actions;
      if (row.type === "website" && clientMap[cId].website.length === 0) clientMap[cId].website = actions;
    }

    // Build final list: interleave social + website, cap at MAX_ITEMS_PER_CLIENT
    return Object.entries(clientMap).map(([cId, c]) => {
      const items: ActionItem[] = [];
      const s = [...c.social];
      const w = [...c.website];

      // Round-robin pick from social + website to get diversity
      while (items.length < MAX_ITEMS_PER_CLIENT) {
        const fromS = s.shift();
        if (fromS) items.push({ text: fromS, type: "social" });
        if (items.length >= MAX_ITEMS_PER_CLIENT) break;
        const fromW = w.shift();
        if (fromW) items.push({ text: fromW, type: "website" });
        if (!fromS && !fromW) break;
      }

      return { clientId: cId, clientName: c.clientName, logoUrl: c.logoUrl, items };
    }).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [rawSummaries, selectedWeek]);

  // ── totals ────────────────────────────────────────────────────────────────

  const totalItems = summaries.reduce((s, c) => s + c.items.length, 0);
  const doneItems = Object.values(status).filter(Boolean).length;
  const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const weekLabel = selectedWeek
    ? `${format(parseISO(selectedWeek.start), "MMM d")} – ${format(parseISO(selectedWeek.end), "MMM d, yyyy")}`
    : "—";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[88vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 flex-shrink-0 space-y-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary flex-shrink-0" />
              Weekly Action Review
            </DialogTitle>

            {/* Week navigator */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7"
                disabled={weekIndex >= availableWeeks.length - 1}
                onClick={() => setWeekIndex(i => i + 1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Badge variant="outline" className="text-xs gap-1 px-2 py-0.5 font-normal">
                <CalendarDays className="w-3 h-3 flex-shrink-0" />
                {weekLabel}
              </Badge>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7"
                disabled={weekIndex <= 0}
                onClick={() => setWeekIndex(i => i - 1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Progress bar + summary */}
          <div className="flex items-center gap-3 pt-2.5">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
              {doneItems}/{totalItems}
              {progressPct === 100 && totalItems > 0 && " 🎉"}
            </span>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
              <ClipboardList className="w-8 h-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No summaries for this week.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summaries.map(summary => (
                <ClientCard
                  key={summary.clientId}
                  summary={summary}
                  status={status}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-border/40 flex-shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Top {MAX_ITEMS_PER_CLIENT} actions per client · synced across all admins
          </p>
          <div className="flex items-center gap-2">
            {doneItems > 0 && (
              <Button
                variant="ghost" size="sm"
                className="text-xs h-7 text-muted-foreground"
                onClick={handleReset}
              >
                Reset
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs" onClick={onClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
