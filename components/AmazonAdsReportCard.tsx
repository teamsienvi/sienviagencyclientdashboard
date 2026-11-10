"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Upload,
    FileSpreadsheet,
    X,
    Download,
    RefreshCw,
    BarChart3,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    TrendingDown,
    TrendingUp,
    Crosshair,
    ChevronDown,
    ChevronUp,
    Target,
    HelpCircle,
    Info,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AmazonKPIs {
    adSales: number | null;
    adSpend: number | null;
    acos: number | null;
    roas: number | null;
    orders: number | null;
    ctr: number | null;
    cvr: number | null;
    avgCpc: number | null;
}

interface TopCampaign {
    name: string;
    spend: number;
    sales: number;
    acos: number;
    orders: number;
    roas: number;
}

interface WastefulTerm {
    term: string;
    clicks: number;
    spend: number;
    sales: number;
    action: string;
}

interface AmazonReportData {
    sourceFileName?: string;
    kpis: AmazonKPIs;
    whatsWorking?: string[];
    whatsNotWorking?: string[];
    strategies?: string[];
    executiveSummary: string[];
    clientNeedsToKnow: string;
    channelSnapshot: string;
    topRevenueCampaigns: TopCampaign[];
    wastefulSearchTerms: WastefulTerm[];
    actionPlan: string[];
    finalRecommendation: string;
    week1Totals?: RawTotals | null;
    dateRange?: DateRange | null;
    week1DateRange?: DateRange | null;
    periodWarning?: string | null;
}

type DateRange = { from: string; to: string };
type RawTotals = { spend: number; sales: number; orders: number; clicks: number; impressions: number };

// Synthesizes High-Level Reporting (What's Working This Week, What's Not, Strategies)
// Uses AI-generated arrays when present and falls back to deterministic data-driven insights for older cached reports.
function deriveHighLevelInsights(
    data: AmazonReportData,
    prevData?: AmazonReportData | null,
    w1RawTotals?: RawTotals | null,
): { whatsWorking: string[]; whatsNotWorking: string[]; strategies: string[] } {
    const campaigns = data.topRevenueCampaigns || [];
    const wasteTerms = data.wastefulSearchTerms || [];
    const kpis = data.kpis;

    // 1. What's Working This Week
    let whatsWorking = Array.isArray(data.whatsWorking) ? data.whatsWorking.filter(Boolean) : [];
    if (whatsWorking.length === 0) {
        const winningCampaigns = campaigns
            .filter(c => c.sales > 0)
            .sort((a, b) => b.sales - a.sales || b.roas - a.roas);

        for (const c of winningCampaigns.slice(0, 3)) {
            whatsWorking.push(
                `"${c.name}" generated $${c.sales.toFixed(2)} in sales (${c.orders} ${c.orders === 1 ? "order" : "orders"}) on $${c.spend.toFixed(2)} spend — delivering a ${c.roas.toFixed(2)}x ROAS (${c.acos.toFixed(1)}% ACoS).`
            );
        }

        const w1Sales = w1RawTotals?.sales ?? prevData?.kpis?.adSales ?? null;
        const w1Spend = w1RawTotals?.spend ?? prevData?.kpis?.adSpend ?? null;
        if (w1Sales != null && kpis.adSales != null && kpis.adSales > w1Sales && w1Sales > 0) {
            const pct = (((kpis.adSales - w1Sales) / w1Sales) * 100).toFixed(1);
            whatsWorking.push(`Ad-attributed revenue grew +${pct}% week-over-week (from $${w1Sales.toFixed(2)} to $${kpis.adSales.toFixed(2)}).`);
        } else if (w1Spend != null && kpis.adSpend != null && kpis.adSpend < w1Spend && w1Spend > 0) {
            const saved = (w1Spend - kpis.adSpend).toFixed(2);
            whatsWorking.push(`Ad spend was tightened by $${saved} week-over-week ($${w1Spend.toFixed(2)} → $${kpis.adSpend.toFixed(2)}) while isolating converting traffic.`);
        }

        if (whatsWorking.length < 3 && kpis.cvr != null && kpis.cvr >= 4) {
            whatsWorking.push(`Account conversion rate (CVR) reached ${kpis.cvr.toFixed(2)}% across ${kpis.orders ?? 0} total orders, showing strong listing-level buyer intent when shoppers click.`);
        }
        if (whatsWorking.length === 0 && (data.executiveSummary?.length || 0) > 0) {
            whatsWorking = data.executiveSummary.slice(0, 2);
        }
    }

    // 2. What's Not Working
    let whatsNotWorking = Array.isArray(data.whatsNotWorking) ? data.whatsNotWorking.filter(Boolean) : [];
    if (whatsNotWorking.length === 0) {
        const zeroSaleCampaigns = campaigns
            .filter(c => c.sales === 0 && c.spend > 0)
            .sort((a, b) => b.spend - a.spend);
        const totalZeroSaleSpend = zeroSaleCampaigns.reduce((s, c) => s + c.spend, 0);

        if (zeroSaleCampaigns.length > 0) {
            const topBleeders = zeroSaleCampaigns
                .slice(0, 2)
                .map(c => `"${c.name}" ($${c.spend.toFixed(2)})`)
                .join(" and ");
            whatsNotWorking.push(
                `${zeroSaleCampaigns.length} ${zeroSaleCampaigns.length === 1 ? "campaign" : "campaigns"} spent a combined $${totalZeroSaleSpend.toFixed(2)} with $0 attributed sales — led by ${topBleeders}.`
            );
        }

        const highAcosCampaigns = campaigns
            .filter(c => c.sales > 0 && c.acos > 50)
            .sort((a, b) => b.spend - a.spend);
        if (highAcosCampaigns.length > 0) {
            const worst = highAcosCampaigns[0];
            whatsNotWorking.push(
                `"${worst.name}" is converting at an elevated ${worst.acos.toFixed(1)}% ACoS (${worst.roas.toFixed(2)}x ROAS), spending $${worst.spend.toFixed(2)} for $${worst.sales.toFixed(2)} in sales.`
            );
        }

        if (wasteTerms.length > 0) {
            const totalWasteSpend = wasteTerms.reduce((s, t) => s + t.spend, 0);
            const totalWasteClicks = wasteTerms.reduce((s, t) => s + t.clicks, 0);
            const topTermNames = wasteTerms.slice(0, 3).map(t => `"${t.term}" ($${t.spend.toFixed(2)})`).join(", ");
            whatsNotWorking.push(
                `Top non-converting search terms bled $${totalWasteSpend.toFixed(2)} across ${totalWasteClicks} clicks with 0 orders — including ${topTermNames}.`
            );
        }

        if (kpis.acos != null && kpis.acos > 45) {
            whatsNotWorking.push(
                `Blended account ACoS sits at ${kpis.acos.toFixed(1)}% (${(kpis.roas ?? 0).toFixed(2)}x ROAS), driven by non-converting discovery and broad/auto targeting spend.`
            );
        }
    }

    // 3. Strategies
    let strategies = Array.isArray(data.strategies) ? data.strategies.filter(Boolean) : [];
    if (strategies.length === 0) {
        if (Array.isArray(data.actionPlan) && data.actionPlan.length > 0) {
            strategies = [...data.actionPlan];
        } else {
            const topWinner = campaigns.find(c => c.sales > 0 && c.roas >= 2);
            const topBleeder = campaigns.filter(c => c.sales === 0 && c.spend > 0).sort((a, b) => b.spend - a.spend)[0];
            if (topWinner) {
                strategies.push(`Reallocate daily budget toward "${topWinner.name}" (${topWinner.roas.toFixed(2)}x ROAS) and isolate its converting search terms into Exact Match campaigns.`);
            }
            if (topBleeder) {
                strategies.push(`Pause or cut bids by 35–50% on "${topBleeder.name}" ($${topBleeder.spend.toFixed(2)} spend, 0 orders) to stop immediate budget bleed.`);
            }
            if (wasteTerms.length > 0) {
                strategies.push(`Add Negative Exact keywords/targets for ${wasteTerms.slice(0, 3).map(t => `"${t.term}"`).join(", ")} to eliminate non-converting click spend.`);
            }
        }
    }

    return { whatsWorking, whatsNotWorking, strategies };
}

const rangeDays = (r?: DateRange | null) => {
    if (!r) return null;
    const ms = new Date(r.to + "T00:00:00").getTime() - new Date(r.from + "T00:00:00").getTime();
    return Number.isFinite(ms) ? Math.round(ms / 86400000) + 1 : null;
};

const fmtRange = (r?: DateRange | null) => {
    if (!r) return "";
    try {
        return `${format(new Date(r.from + "T00:00:00"), "MMM d")} – ${format(new Date(r.to + "T00:00:00"), "MMM d, yyyy")}`;
    } catch { return `${r.from} – ${r.to}`; }
};

// Flags uploads where Week 1 and Week 2 clearly cover different lengths of time
// (e.g. a 30-day export compared against a 7-day export).
const detectPeriodMismatch = (
    w2: RawTotals | null | undefined,
    w1: RawTotals | null | undefined,
    w2Range?: DateRange | null,
    w1Range?: DateRange | null,
): string | null => {
    const d2 = rangeDays(w2Range), d1 = rangeDays(w1Range);
    if (d1 && d2 && Math.abs(d1 - d2) > 1) {
        return `Week 1 covers ${d1} days but Week 2 covers ${d2} days, so the comparison isn't like-for-like. Re-export both files with the same date range length.`;
    }
    if (!w1 || !w2) return null;
    const ratio = (a: number, b: number) => (a > 0 && b > 0 ? a / b : null);
    const spendRatio = ratio(w2.spend, w1.spend);
    const impRatio = ratio(w2.impressions, w1.impressions);
    const r = spendRatio ?? impRatio;
    if (r != null && (r >= 1.8 || r <= 0.55)) {
        const pct = Math.round(r * 100);
        return `Week 2 ad spend is ${pct}% of Week 1. That usually means one file was exported with a different date range (e.g. 30 days vs 7 days). Check both exports cover the same number of days before trusting the week-over-week numbers.`;
    }
    return null;
};

interface AmazonAdsReportCardProps {
    clientId: string;
    clientName: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (v: number | null | undefined) =>
    v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number | null | undefined) =>
    v == null ? "—" : `${v.toFixed(1)}%`;

const fmtX = (v: number | null | undefined) =>
    v == null ? "—" : `${v.toFixed(2)}x`;

const fmtN = (v: number | null | undefined) =>
    v == null ? "—" : v.toLocaleString();

// ─── ACoS colour helper ───────────────────────────────────────────────────────
const acosClass = (acos: number | null) => {
    if (acos == null) return "";
    if (acos <= 25) return "text-emerald-400";
    if (acos <= 50) return "text-amber-400";
    return "text-red-400";
};

const roasClass = (roas: number | null) => {
    if (roas == null) return "";
    if (roas >= 4) return "text-emerald-400";
    if (roas >= 2) return "text-amber-400";
    return "text-red-400";
};

// ─── Parse date range from Amazon bulk export filename ────────────────────────
// Pattern: bulk-XXXX-YYYYMMDD-YYYYMMDD-NNNNN.xlsx
const parseDateRangeFromFilename = (filename: string): { from: string; to: string } | null => {
    const match = filename.match(/(\d{8})-(\d{8})/);
    if (!match) return null;
    const fromRaw = match[1];
    const toRaw = match[2];
    const from = `${fromRaw.substring(0, 4)}-${fromRaw.substring(4, 6)}-${fromRaw.substring(6, 8)}`;
    const to = `${toRaw.substring(0, 4)}-${toRaw.substring(4, 6)}-${toRaw.substring(6, 8)}`;
    return { from, to };
};

// ─── PDF print helper ─────────────────────────────────────────────────────────────────
function buildPrintHTML(
    data: AmazonReportData,
    clientName: string,
    fileName: string,
    prevData?: AmazonReportData | null,
    w1RawTotals?: { spend: number; sales: number; orders: number; clicks: number; impressions: number } | null,
): string {
    const today = format(new Date(), "MMMM d, yyyy");
    const displayFileName = data.sourceFileName || fileName;

    const kpiRow = (label: string, value: string) =>
        `<div class="kpi-cell"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

    // ─── Week-over-Week Progress table ───
    const buildWoWSection = () => {
        // Compute W1 KPIs: prefer raw totals from uploaded file, else fall back to previous DB report
        const w1kpis = w1RawTotals ? {
            adSales: w1RawTotals.sales,
            adSpend: w1RawTotals.spend,
            orders: w1RawTotals.orders,
            acos: w1RawTotals.sales > 0 ? (w1RawTotals.spend / w1RawTotals.sales) * 100 : null as number | null,
            roas: w1RawTotals.spend > 0 ? w1RawTotals.sales / w1RawTotals.spend : null as number | null,
            cvr: w1RawTotals.clicks > 0 ? (w1RawTotals.orders / w1RawTotals.clicks) * 100 : null as number | null,
        } : prevData ? {
            adSales: prevData.kpis.adSales,
            adSpend: prevData.kpis.adSpend,
            orders: prevData.kpis.orders,
            acos: prevData.kpis.acos,
            roas: prevData.kpis.roas,
            cvr: prevData.kpis.cvr,
        } : null;

        if (!w1kpis) return '';

        const rows = [
            { metric: 'Ad Sales', w1: w1kpis.adSales, w2: data.kpis.adSales, fmt: fmt$, unit: '%', good: 'up' },
            { metric: 'Ad Spend', w1: w1kpis.adSpend, w2: data.kpis.adSpend, fmt: fmt$, unit: '%', good: 'down' },
            { metric: 'Orders', w1: w1kpis.orders, w2: data.kpis.orders, fmt: fmtN, unit: '%', good: 'up' },
            { metric: 'ACoS', w1: w1kpis.acos, w2: data.kpis.acos, fmt: fmtPct, unit: ' pts', good: 'down' },
            { metric: 'ROAS', w1: w1kpis.roas, w2: data.kpis.roas, fmt: fmtX, unit: '%', good: 'up' },
            { metric: 'CVR', w1: w1kpis.cvr, w2: data.kpis.cvr, fmt: fmtPct, unit: ' pts', good: 'up' },
        ];
        const tableRows = rows.map(r => {
            let changeStr = '—';
            let changeClass = '';
            if (r.w1 != null && r.w2 != null) {
                if (r.unit === ' pts') {
                    const diff = r.w2 - r.w1;
                    const isGood = r.good === 'up' ? diff > 0 : diff < 0;
                    const isBad = r.good === 'up' ? diff < 0 : diff > 0;
                    changeStr = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}${r.unit}`;
                    changeClass = isGood ? 'green' : isBad ? 'red' : '';
                } else if (r.w1 !== 0) {
                    const pct = ((r.w2 - r.w1) / Math.abs(r.w1)) * 100;
                    const isGood = r.good === 'up' ? pct > 0 : pct < 0;
                    const isBad = r.good === 'up' ? pct < 0 : pct > 0;
                    changeStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                    changeClass = isGood ? 'green' : isBad ? 'red' : '';
                }
            }
            return `<tr><td>${r.metric}</td><td class="num">${r.fmt(r.w1)}</td><td class="num">${r.fmt(r.w2)}</td><td class="num ${changeClass}">${changeStr}</td></tr>`;
        }).join('');

        return `
        <div class="section">
            <div class="section-title">Week-over-Week Progress</div>
            <table>
                <thead><tr><th>Metric</th><th class="num">Previous</th><th class="num">Current</th><th class="num">Change</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`;
    };

    const campaignRows = data.topRevenueCampaigns.map((c) => `
        <tr>
            <td>${c.name}</td>
            <td class="num">$${c.spend.toFixed(2)}</td>
            <td class="num">$${c.sales.toFixed(2)}</td>
            <td class="num ${c.acos <= 25 ? "green" : c.acos <= 50 ? "amber" : "red"}">${c.acos.toFixed(1)}%</td>
            <td class="num">${c.orders}</td>
            <td class="num ${c.roas >= 4 ? "green" : c.roas >= 2 ? "amber" : "red"}">${c.roas.toFixed(2)}x</td>
        </tr>`).join("");

    const wasteRows = data.wastefulSearchTerms.map((t) => `
        <tr>
            <td>${t.term}</td>
            <td class="num">${t.clicks}</td>
            <td class="num red">$${t.spend.toFixed(2)}</td>
            <td class="num">$${t.sales.toFixed(2)}</td>
            <td>${t.action}</td>
        </tr>`).join("");

    const execBullets = data.executiveSummary.map((b) => `<li>${b}</li>`).join("");
    const actionBullets = data.actionPlan.map((b) => `<li>${b}</li>`).join("");
    const highLevel = deriveHighLevelInsights(data, prevData, w1RawTotals);
    const workingBullets = highLevel.whatsWorking.map((b) => `<li>${b}</li>`).join("");
    const notWorkingBullets = highLevel.whatsNotWorking.map((b) => `<li>${b}</li>`).join("");
    const strategyBullets = highLevel.strategies.map((b) => `<li>${b}</li>`).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Amazon Ads Report — ${clientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 32px; max-width: 900px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #555; margin-bottom: 20px; }
  .kpi-bar { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; background: #f4f4f8; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
  .kpi-cell { text-align: center; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #666; margin-bottom: 3px; }
  .kpi-value { font-size: 15px; font-weight: 700; color: #111; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1.5px solid #e2e2e2; padding-bottom: 4px; margin-bottom: 8px; color: #333; }
  .hl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
  .hl-card { border-radius: 6px; padding: 10px 12px; border: 1px solid #e2e2e2; }
  .hl-working { background: #f0fdf4; border-color: #bbf7d0; }
  .hl-not-working { background: #fef2f2; border-color: #fecaca; }
  .hl-strategies { background: #fffbeb; border-color: #fde68a; }
  .hl-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
  ul { padding-left: 16px; }
  li { margin-bottom: 4px; line-height: 1.5; }
  p { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #f4f4f8; text-align: left; padding: 5px 8px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: .4px; color: #555; }
  td { padding: 5px 8px; border-bottom: 1px solid #ececec; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .green { color: #16a34a; font-weight: 600; }
  .amber { color: #d97706; font-weight: 600; }
  .red { color: #dc2626; font-weight: 600; }
  .final-box { background: #fafafa; border: 1px solid #e2e2e2; border-left: 3px solid #111; border-radius: 4px; padding: 12px 14px; }
  .waste-header { color: #dc2626; }
  footer { margin-top: 24px; font-size: 9px; color: #999; border-top: 1px solid #e2e2e2; padding-top: 8px; }
  @media print {
    body { padding: 20px; }
    @page { size: A4; margin: 15mm; }
  }
</style>
</head>
<body>
  <h1>Amazon Ads Report — ${clientName}</h1>
  <p class="subtitle">Source file: ${displayFileName} &nbsp;|&nbsp; Generated: ${today}</p>

  <div class="kpi-bar">
    ${kpiRow("Ad Sales", fmt$(data.kpis.adSales))}
    ${kpiRow("Ad Spend", fmt$(data.kpis.adSpend))}
    ${kpiRow("ACoS", fmtPct(data.kpis.acos))}
    ${kpiRow("ROAS", fmtX(data.kpis.roas))}
    ${kpiRow("Orders", fmtN(data.kpis.orders))}
    ${kpiRow("CTR", fmtPct(data.kpis.ctr))}
    ${kpiRow("CVR", fmtPct(data.kpis.cvr))}
    ${kpiRow("Avg CPC", fmt$(data.kpis.avgCpc))}
  </div>

  ${buildWoWSection()}

  <div class="section">
    <div class="section-title">High-Level Weekly Report</div>
    <div class="hl-grid">
      <div class="hl-card hl-working">
        <div class="hl-title green">What's Working This Week</div>
        <ul>${workingBullets || "<li>No profitable campaigns recorded in this period.</li>"}</ul>
      </div>
      <div class="hl-card hl-not-working">
        <div class="hl-title red">What's Not Working</div>
        <ul>${notWorkingBullets || "<li>No major budget bleeders detected.</li>"}</ul>
      </div>
      <div class="hl-card hl-strategies">
        <div class="hl-title amber">Strategies</div>
        <ul>${strategyBullets || "<li>Maintain current bidding and targeting controls.</li>"}</ul>
      </div>
    </div>
  </div>

  ${(data.executiveSummary?.length || 0) > 0 ? `
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <ul>${execBullets}</ul>
  </div>` : ""}

  ${data.clientNeedsToKnow ? `
  <div class="section">
    <div class="section-title">What the Client Needs to Know</div>
    <p>${data.clientNeedsToKnow}</p>
  </div>` : ""}

  ${data.channelSnapshot ? `
  <div class="section">
    <div class="section-title">Channel Snapshot</div>
    <p>${data.channelSnapshot}</p>
  </div>` : ""}

  ${(data.topRevenueCampaigns?.length || 0) > 0 ? `
  <div class="section">
    <div class="section-title">Top Revenue Drivers</div>
    <table>
      <thead><tr><th>Campaign</th><th class="num">Spend</th><th class="num">Sales</th><th class="num">ACoS</th><th class="num">Orders</th><th class="num">ROAS</th></tr></thead>
      <tbody>${campaignRows}</tbody>
    </table>
  </div>` : ""}

  ${(data.wastefulSearchTerms?.length || 0) > 0 ? `
  <div class="section">
    <div class="section-title waste-header">Highest Spend Search Terms With No Sales</div>
    <table>
      <thead><tr><th>Search Term</th><th class="num">Clicks</th><th class="num">Spend</th><th class="num">Sales</th><th>Action</th></tr></thead>
      <tbody>${wasteRows}</tbody>
    </table>
  </div>` : ""}

  ${(data.actionPlan?.length || 0) > 0 ? `
  <div class="section">
    <div class="section-title">Action Plan for the Next Period</div>
    <ul>${actionBullets}</ul>
  </div>` : ""}

  ${data.finalRecommendation ? `
  <div class="section">
    <div class="section-title">Final Recommendation</div>
    <div class="final-box"><p>${data.finalRecommendation}</p></div>
  </div>` : ""}

  <footer>Generated by Sienvi Agency Dashboard &nbsp;|&nbsp; ${today}</footer>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AmazonAdsReportCard({ clientId, clientName }: AmazonAdsReportCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [week1File, setWeek1File] = useState<File | null>(null);
    const [week1Totals, setWeek1Totals] = useState<{ spend: number; sales: number; orders: number; clicks: number; impressions: number } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<AmazonReportData | null>(null);
    const [previousReport, setPreviousReport] = useState<AmazonReportData | null>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const { toast } = useToast();
    const printFrameRef = useRef<HTMLIFrameElement | null>(null);
    const queryClient = useQueryClient();
    const hasTriggeredAnalysis = useRef(false);

    // Reset local state on client switch to prevent leaking/stuck report screens
    useEffect(() => {
        setFile(null);
        setWeek1File(null);
        setWeek1Totals(null);
        setReport(null);
        setPreviousReport(null);
        setGeneratedAt(null);
        setIsAnalyzing(false);
        hasTriggeredAnalysis.current = false;
    }, [clientId]);

    const { data: cachedData, isLoading: isFetchingCache, refetch: refetchReport } = useQuery({
        queryKey: ["amazon-ads-report", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("amazon_ads_reports" as any)
                .select("parsed_data, generated_at, source_file_name, generation_status, report_period")
                .eq("client_id", clientId)
                .order("generated_at", { ascending: false })
                .limit(2);

            if (error) throw error;
            return data as any[] || [];
        },
        enabled: !!clientId,
        refetchInterval: (query) => {
            const rows = query.state.data as any[] | undefined;
            const latest = rows?.[0];
            if (latest?.generation_status !== 'pending') return false;
            const ageMs = latest.generated_at ? Date.now() - new Date(latest.generated_at).getTime() : Infinity;
            return ageMs < 90_000 ? 4000 : false;
        }
    });

    useEffect(() => {
        if (cachedData && cachedData.length > 0) {
            const latest = cachedData[0];
            const prev = cachedData.length > 1 ? cachedData[1] : null;
            const pendingAgeMs = latest.generated_at ? Date.now() - new Date(latest.generated_at).getTime() : Infinity;

            if (latest.generation_status === 'pending' && pendingAgeMs < 90_000) {
                setIsAnalyzing(true);
                hasTriggeredAnalysis.current = true;
            } else if (latest.generation_status === 'complete' && latest.parsed_data) {
                setIsAnalyzing(false);
                setReport(latest.parsed_data as AmazonReportData);
                if (latest.generated_at) {
                    setGeneratedAt(new Date(latest.generated_at));
                }
                if (latest.source_file_name && !file) {
                    setFile(new File([""], latest.source_file_name, { type: "text/csv" }));
                }
                // Set previous report for comparison
                if (prev?.generation_status === 'complete' && prev?.parsed_data) {
                    setPreviousReport(prev.parsed_data as AmazonReportData);
                }
                // Restore Week 1 totals that were uploaded alongside this report
                if ((latest.parsed_data as any).week1Totals) {
                    setWeek1Totals((latest.parsed_data as any).week1Totals);
                }
            } else {
                // Either 'failed' or a stale 'pending' row (>90s old) — never lock the UI in loading state
                setIsAnalyzing(false);
                if (prev?.generation_status === 'complete' && prev?.parsed_data && !report) {
                    setReport(prev.parsed_data as AmazonReportData);
                    if (prev.generated_at) setGeneratedAt(new Date(prev.generated_at));
                }
                if (latest.generation_status === 'failed' && hasTriggeredAnalysis.current) {
                    toast({ title: "Analysis failed", description: "Background worker failed to process the report.", variant: "destructive" });
                    hasTriggeredAnalysis.current = false;
                }
            }
        }
    }, [cachedData, file, report, toast]);

    // ─── File handling ───────────────────────────────────────────────────────
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        if (![".csv", ".xlsx", ".xls"].includes(ext)) {
            toast({ title: "Invalid file", description: "Upload a .csv or .xlsx Amazon Ads report", variant: "destructive" });
            return;
        }
        setFile(f);
        setReport(null);
    }, [toast]);

    const handleWeek1FileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        if (![".csv", ".xlsx", ".xls"].includes(ext)) {
            toast({ title: "Invalid file", description: "Upload a .csv or .xlsx Amazon Ads report", variant: "destructive" });
            return;
        }
        setWeek1File(f);
        setReport(null);
    }, [toast]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) { setFile(f); setReport(null); }
    }, []);

    // ─── Parse file client-side ───────────────────────────────────────────────
    const parseFileClientSide = async (f: File): Promise<{
        csvText: string;
        exactTotals: { spend: number; sales: number; orders: number; clicks: number; impressions: number };
        exactCampaigns: TopCampaign[];
        exactWaste: WastefulTerm[];
        fileName: string;
        dateRange: DateRange | null;
    }> => {
        const arrayBuffer = await f.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Crucial fix: Amazon Bulksheet exports often contain truncated/malformed dimension tags (e.g. A1:BB1)
        // Recalculate sheet['!ref'] from the actual cells present in the sheet
        const fixSheetRef = (sheet: XLSX.WorkSheet) => {
            const cellKeys = Object.keys(sheet).filter(k => !k.startsWith('!'));
            if (cellKeys.length === 0) return;
            let minR = Infinity, maxR = 0, minC = Infinity, maxC = 0;
            for (const k of cellKeys) {
                const cell = XLSX.utils.decode_cell(k);
                if (cell.r < minR) minR = cell.r;
                if (cell.r > maxR) maxR = cell.r;
                if (cell.c < minC) minC = cell.c;
                if (cell.c > maxC) maxC = cell.c;
            }
            sheet['!ref'] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
        };

        for (const name of workbook.SheetNames) {
            if (workbook.Sheets[name]) {
                fixSheetRef(workbook.Sheets[name]);
            }
        }

        // For Bulk files, process Campaigns & Search Term sheets
        const isBulkFile = workbook.SheetNames.length > 2 ||
            workbook.SheetNames.some(n => n.toLowerCase().includes('campaign'));
        const sheetsToProcess = isBulkFile
            ? workbook.SheetNames.filter(n =>
                n.toLowerCase().includes('campaign') ||
                n.toLowerCase().includes('sponsored') ||
                n.toLowerCase().includes('search term')
            )
            : workbook.SheetNames;
        const finalSheets = sheetsToProcess.length > 0 ? sheetsToProcess : workbook.SheetNames;

        const allText: string[] = [];
        let exactTotals = { spend: 0, sales: 0, orders: 0, clicks: 0, impressions: 0 };
        const campaignRows: TopCampaign[] = [];
        const seenCampaignIds = new Set<string>();
        const termAgg = new Map<string, { clicks: number; spend: number; sales: number }>();
        // Track the earliest/latest dates found in any Date / Start Date / End Date column.
        // Bulk files usually have no date columns (range lives in the filename), but
        // campaign/search-term reports do — this catches renamed files.
        let minDate: string | null = null, maxDate: string | null = null;
        const toISODate = (v: any): string | null => {
            if (v == null || v === "") return null;
            if (typeof v === "number") {
                if (v < 30000 || v > 80000) return null; // not an Excel date serial
                const d = XLSX.SSF.parse_date_code(v);
                return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
            }
            const s = String(v).trim();
            if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
            const dt = new Date(s);
            if (isNaN(dt.getTime()) || dt.getFullYear() < 2015) return null;
            return format(dt, "yyyy-MM-dd");
        };

        for (const sheetName of finalSheets) {
            const sheet = workbook.Sheets[sheetName];

            // Only compute exact totals from campaign sheets (avoid double counting search term / ad group totals)
            const isCampaignSheet = sheetName.toLowerCase().includes('campaign') ||
                sheetName.toLowerCase().includes('sponsored products') ||
                sheetName.toLowerCase().includes('sponsored brands') ||
                sheetName.toLowerCase().includes('sponsored display');
            const isSearchTermSheet = sheetName.toLowerCase().includes('search term');

            const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
            if (rows.length === 0) continue;
            const keys = Object.keys(rows[0]).map(k => k.trim());
            const entityKey = keys.find(k => k.toLowerCase() === 'entity' || k.toLowerCase() === 'record type');

            // Patterns are checked in priority order, exact header match first, so e.g. the
            // Sponsored Display "Cost Type" column is never mistaken for "Spend".
            const findKey = (patterns: string[]) => {
                for (const p of patterns) {
                    const exact = keys.find(k => k.toLowerCase() === p);
                    if (exact) return exact;
                }
                for (const p of patterns) {
                    const partial = keys.find(k => k.toLowerCase().includes(p));
                    if (partial) return partial;
                }
                return undefined;
            };
            const spendKey = findKey(['spend', 'cost']);
            const salesKey = findKey(['14 day total sales', 'total sales', 'sales']);
            const ordersKey = findKey(['14 day total orders', '7 day total orders', 'total orders', 'orders', 'unit orders']);
            const clicksKey = findKey(['clicks']);
            const impressionsKey = findKey(['impressions']);
            const campaignNameKey = findKey(['campaign name', 'campaign name (informational only)', 'name']);
            const campaignIdKey = keys.find(k => k.toLowerCase() === 'campaign id');
            const searchTermKey = findKey(['customer search term']);
            // In Amazon Bulksheets, "Start Date" and "End Date" on Campaign rows are the campaign's
            // historical creation/flight dates (often years old), NOT the export's reporting period.
            const dateKeys = keys.filter(k => {
                const lower = k.toLowerCase();
                if (isBulkFile) return lower === 'date';
                return ['date', 'start date', 'end date'].includes(lower);
            });
            if (dateKeys.length) {
                for (const row of rows) {
                    for (const dk of dateKeys) {
                        const iso = toISODate(row[dk]);
                        if (!iso) continue;
                        if (!minDate || iso < minDate) minDate = iso;
                        if (!maxDate || iso > maxDate) maxDate = iso;
                    }
                }
            }
            const parseNum = (row: Record<string, any>, k?: string) => k && row[k] ? parseFloat(String(row[k]).replace(/[,$%]/g, '')) || 0 : 0;

            if (isCampaignSheet || !isBulkFile) {
                for (const row of rows) {
                    if (entityKey && String(row[entityKey] || '').trim().toLowerCase() !== 'campaign') continue;
                    // The same Sponsored Brands campaign is listed in both the SB and SB Multi Ad Group sheets
                    const campaignId = campaignIdKey ? String(row[campaignIdKey] || '').trim() : '';
                    if (campaignId) {
                        if (seenCampaignIds.has(campaignId)) continue;
                        seenCampaignIds.add(campaignId);
                    }
                    const spend = parseNum(row, spendKey), sales = parseNum(row, salesKey), orders = parseNum(row, ordersKey);
                    exactTotals.spend += spend;
                    exactTotals.sales += sales;
                    exactTotals.orders += orders;
                    exactTotals.clicks += parseNum(row, clicksKey);
                    exactTotals.impressions += parseNum(row, impressionsKey);
                    const name = campaignNameKey ? String(row[campaignNameKey] || '').trim() : '';
                    if (name && (spend > 0 || sales > 0)) {
                        campaignRows.push({
                            name, spend, sales, orders,
                            acos: sales > 0 ? (spend / sales) * 100 : 0,
                            roas: spend > 0 ? sales / spend : 0,
                        });
                    }
                }
            }

            if (isSearchTermSheet && searchTermKey) {
                for (const row of rows) {
                    const term = String(row[searchTermKey] || '').trim();
                    if (!term) continue;
                    const a = termAgg.get(term) || { clicks: 0, spend: 0, sales: 0 };
                    a.clicks += parseNum(row, clicksKey);
                    a.spend += parseNum(row, spendKey);
                    a.sales += parseNum(row, salesKey);
                    termAgg.set(term, a);
                }
            }

            // Build the text sent to the AI. Bulk sheets contain every keyword / product-ad row,
            // which blows past the size limit, so keep only campaign rows and search terms with spend.
            let textRows = rows;
            if (isBulkFile && isCampaignSheet && entityKey) {
                textRows = rows.filter(r => String(r[entityKey] || '').trim().toLowerCase() === 'campaign');
            } else if (isBulkFile && isSearchTermSheet) {
                textRows = rows.filter(r => parseNum(r, spendKey) > 0)
                    .sort((a, b) => parseNum(b, spendKey) - parseNum(a, spendKey));
            }
            if (textRows.length === 0) continue;
            const wanted = Object.keys(rows[0]).filter(k => {
                const l = k.trim().toLowerCase();
                return ['campaign name', 'customer search term', 'keyword text', 'match type', 'state', 'targeting type', 'impressions', 'clicks', 'spend', 'sales', 'orders', 'units', 'acos', 'roas', 'cpc'].some(p => l.includes(p));
            });
            const projected = isBulkFile && wanted.length
                ? textRows.map(r => Object.fromEntries(wanted.map(k => [k, r[k] ?? ""])))
                : textRows;
            const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(projected));
            if (csv.trim()) allText.push(`--- Sheet: ${sheetName} (${textRows.length} rows) ---\n${csv}`);
        }

        const MAX_CHARS = 50000;
        let csvText = allText.join('\n\n');
        if (csvText.length > MAX_CHARS) csvText = csvText.substring(0, MAX_CHARS) + '\n\n[... truncated ...]';

        const round2 = (v: number) => Math.round(v * 100) / 100;
        const exactCampaigns = campaignRows
            .sort((a, b) => b.sales - a.sales || b.spend - a.spend)
            .map(c => ({ ...c, spend: round2(c.spend), sales: round2(c.sales), acos: round2(c.acos), roas: round2(c.roas) }));
        const exactWaste: WastefulTerm[] = Array.from(termAgg.entries())
            .filter(([, a]) => a.sales === 0 && a.spend > 0)
            .sort((a, b) => b[1].spend - a[1].spend)
            .slice(0, 6)
            .map(([term, a]) => ({ term, clicks: a.clicks, spend: round2(a.spend), sales: 0, action: "Negate or cut bid" }));

        const inferredRange = minDate && maxDate ? { from: minDate, to: maxDate } : null;
        const inferredDays = rangeDays(inferredRange);
        const validInferredRange = inferredRange && inferredDays != null && inferredDays >= 1 && inferredDays <= 65
            ? inferredRange
            : null;
        const dateRange = parseDateRangeFromFilename(f.name) ?? validInferredRange;

        return { csvText, exactTotals, exactCampaigns, exactWaste, fileName: f.name, dateRange };
    };

    // ─── Analysis ────────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!file) {
            toast({ title: "No file selected", description: "Upload an Amazon Ads CSV or Excel report", variant: "destructive" });
            return;
        }
        // Saved reports only restore the file *name* (the file itself isn't stored),
        // so re-analyzing needs a fresh upload.
        if (file.size === 0 || (week1File && week1File.size === 0)) {
            toast({
                title: "Please re-upload the report file",
                description: `The original file "${file.size === 0 ? file.name : week1File?.name}" isn't stored with saved reports. Click the upload box and select it again, then press Generate Report.`,
                variant: "destructive",
            });
            return;
        }

        setIsAnalyzing(true);
        hasTriggeredAnalysis.current = true;
        try {
            const { data: { session } } = await supabase.auth.getSession();

            // Parse client-side — no binary upload, no xlsx import on edge function
            toast({ title: "Parsing file…", description: "Reading your report data" });
            const { csvText, exactTotals, exactCampaigns, exactWaste, fileName, dateRange } = await parseFileClientSide(file);

            // Guard: if no campaign metrics could be read, don't generate a misleading all-zero AI report
            if (exactTotals.spend === 0 && exactTotals.sales === 0 && exactTotals.clicks === 0 && exactTotals.impressions === 0) {
                throw new Error("Couldn't read any campaign spend/sales/clicks from this file. Make sure it's an Amazon Ads bulk or campaign report covering a period with activity.");
            }

            // Parse Week 1 file if provided
            let w1Totals: typeof exactTotals | null = null;
            let w1Range: DateRange | null = null;
            if (week1File) {
                const w1 = await parseFileClientSide(week1File);
                w1Totals = w1.exactTotals;
                w1Range = w1.dateRange;
                setWeek1Totals(w1Totals);
            }

            // Catch mismatched exports (e.g. 30-day vs 7-day) before generating a misleading comparison
            const periodWarning = detectPeriodMismatch(exactTotals, w1Totals, dateRange, w1Range);
            if (periodWarning) {
                const proceed = window.confirm(`⚠️ Possible date range mismatch\n\n${periodWarning}\n\nWeek 1: $${w1Totals?.spend.toFixed(2)} spend, ${w1Totals?.orders} orders${w1Range ? ` (${fmtRange(w1Range)})` : ""}\nWeek 2: $${exactTotals.spend.toFixed(2)} spend, ${exactTotals.orders} orders${dateRange ? ` (${fmtRange(dateRange)})` : ""}\n\nPress OK to generate anyway, or Cancel to pick different files.`);
                if (!proceed) {
                    setIsAnalyzing(false);
                    hasTriggeredAnalysis.current = false;
                    return;
                }
            }

            toast({ title: "Analyzing…", description: "Sending to AI for analysis" });
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-amazon-ads`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        clientId,
                        fileName,
                        rawData: csvText,
                        exactTotals,
                        exactCampaigns,
                        exactWaste,
                        week1Totals: w1Totals,
                        // Undated filenames fall back to today's date (not the month) so each upload
                        // gets its own row and sorts after earlier dated reports.
                        reportPeriod: dateRange ? `${dateRange.from}_${dateRange.to}` : new Date().toISOString().substring(0, 10),
                        dateRange,
                        week1DateRange: w1Range,
                        periodWarning,
                    }),
                }
            );

            if (!response.ok) {
                let errPayload: any = {};
                try { errPayload = await response.json(); } catch { /* not json */ }
                throw new Error(errPayload.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            if (result.status === 'complete' && result.data) {
                setReport(result.data);
                setGeneratedAt(new Date());
                setIsAnalyzing(false);
                hasTriggeredAnalysis.current = false;
                toast({ title: "Report ready!", description: "Your Amazon Ads report has been generated." });
            } else {
                setIsAnalyzing(false);
                toast({ title: "Processing", description: "Report is being processed." });
            }

            queryClient.invalidateQueries({ queryKey: ["amazon-ads-report", clientId] });
            queryClient.invalidateQueries({ queryKey: ["amazon-ads-overview", clientId] });
            queryClient.invalidateQueries({ queryKey: ["client-connected-accounts", clientId] });

        } catch (err: any) {
            toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
            setIsAnalyzing(false);
            hasTriggeredAnalysis.current = false;
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ─── PDF Download ─────────────────────────────────────────────────────────
    const handleDownloadPDF = () => {
        if (!report) return;

        const html = buildPrintHTML(report, clientName, file?.name || report.sourceFileName || "Cached Report", previousReport, week1Totals);

        // Open in a new window and trigger print
        const win = window.open("", "_blank", "width=960,height=800");
        if (!win) {
            toast({ title: "Popup blocked", description: "Allow popups and try again.", variant: "destructive" });
            return;
        }
        win.document.write(html);
        win.document.close();
        win.focus();
        // Small delay to let styles render before print dialog
        setTimeout(() => { win.print(); }, 400);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                        <BarChart3 className="h-5 w-5 text-orange-400" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            Amazon Ads Report
                            <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20">
                                PDF Export
                            </Badge>
                        </CardTitle>
                        {generatedAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Generated {format(generatedAt, "MMM d, yyyy 'at' h:mm a")}
                                {file && ` · ${file.name}`}
                            </p>
                        )}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0" 
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                    {/* Upload Zone — Dual file for WoW comparison */}
                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Week 1 (Optional) */}
                        <div
                            className="border-2 border-dashed border-border/60 rounded-lg p-3 text-center hover:border-blue-500/40 transition-colors cursor-pointer"
                            onClick={() => document.getElementById(`amazon-w1-upload-${clientId}`)?.click()}
                        >
                            <input
                                id={`amazon-w1-upload-${clientId}`}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleWeek1FileChange}
                                className="hidden"
                            />
                            {week1File ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-blue-400" />
                                    <span className="text-xs font-medium truncate max-w-[140px]">{week1File.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={(e) => { e.stopPropagation(); setWeek1File(null); setWeek1Totals(null); }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    <p className="text-xs font-medium text-blue-400">Week 1 (Previous)</p>
                                    <p className="text-[10px] text-muted-foreground/60">Optional — for WoW comparison</p>
                                </div>
                            )}
                        </div>

                        {/* Week 2 (Current / Required) */}
                        <div
                            className="border-2 border-dashed border-border/60 rounded-lg p-3 text-center hover:border-orange-500/40 transition-colors cursor-pointer"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById(`amazon-upload-${clientId}`)?.click()}
                        >
                            <input
                                id={`amazon-upload-${clientId}`}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileSpreadsheet className="h-4 w-4 text-orange-400" />
                                    <span className="text-xs font-medium truncate max-w-[140px]">{file.name}</span>
                                    <Badge variant="secondary" className="text-[9px]">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={(e) => { e.stopPropagation(); setFile(null); setReport(null); }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    <Upload className="h-5 w-5 mx-auto text-muted-foreground/60" />
                                    <p className="text-xs font-medium text-orange-400">Week 2 (Current)</p>
                                    <p className="text-[10px] text-muted-foreground/60">.csv or .xlsx report</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !file}
                            className="h-8 text-xs bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                        >
                            <Crosshair className={`h-3 w-3 mr-1.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                            {isAnalyzing ? "Analyzing…" : report ? "Re-analyze" : "Generate Report"}
                        </Button>

                        {report && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadPDF}
                                    className="h-8 text-xs border-orange-500/40 text-orange-400 hover:text-orange-300 hover:border-orange-500/60"
                                >
                                    <Download className="h-3 w-3 mr-1.5" />
                                    Download PDF
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => { 
                                        setReport(null); 
                                        setFile(null); 
                                        setWeek1File(null);
                                        setWeek1Totals(null);
                                        await supabase.from("amazon_ads_reports" as any).delete().eq("client_id", clientId);
                                        queryClient.invalidateQueries({ queryKey: ["amazon-ads-report", clientId] });
                                    }}
                                    className="h-8 text-xs text-muted-foreground"
                                >
                                    Clear
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Loading State */}
                {isAnalyzing && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin text-orange-400" />
                            Crunching your Amazon data…
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                        <Skeleton className="h-32" />
                        <Skeleton className="h-48" />
                    </div>
                )}

                {/* Empty State */}
                {!isAnalyzing && !report && (
                    <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Upload an Amazon Ads report and click Generate</p>
                        <p className="text-xs mt-1 opacity-60 mb-2">
                            Supports Campaign Performance and Search Term reports
                        </p>
                        {cachedData?.[0]?.generation_status === 'failed' && (
                            <p className="text-xs mt-2 text-red-400 bg-red-500/10 py-1.5 px-3 rounded border border-red-500/20 inline-block font-medium">
                                Previous analysis failed. Please try re-uploading the report.
                            </p>
                        )}
                    </div>
                )}

                {/* Report Output */}
                {!isAnalyzing && report && (
                    <div className="space-y-5">

                        {/* Reporting period + date range mismatch warning */}
                        {(() => {
                            const warning = report.periodWarning
                                ?? detectPeriodMismatch(
                                    report.kpis.adSpend != null ? { spend: report.kpis.adSpend, sales: report.kpis.adSales ?? 0, orders: report.kpis.orders ?? 0, clicks: 0, impressions: 0 } : null,
                                    report.week1Totals ?? week1Totals,
                                    report.dateRange,
                                    report.week1DateRange,
                                );
                            const days = rangeDays(report.dateRange);
                            return (
                                <>
                                    {report.dateRange && (
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <Badge variant="outline" className="text-[11px] font-normal border-orange-500/30 text-orange-400">
                                                Reporting period: {fmtRange(report.dateRange)}{days ? ` (${days} days)` : ""}
                                            </Badge>
                                            {report.week1DateRange && (
                                                <Badge variant="outline" className="text-[11px] font-normal">
                                                    Compared with: {fmtRange(report.week1DateRange)}{rangeDays(report.week1DateRange) ? ` (${rangeDays(report.week1DateRange)} days)` : ""}
                                                </Badge>
                                            )}
                                        </div>
                                    )}
                                    {warning && (
                                        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs">
                                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                            <div className="space-y-0.5">
                                                <p className="font-semibold text-foreground">Possible date range mismatch</p>
                                                <p className="text-muted-foreground">{warning}</p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}

                        {/* KPI Bar — with W1/W2 comparison if previous report exists */}
                        <TooltipProvider delayDuration={150}>
                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                {([
                                    { 
                                        label: "Ad Sales", 
                                        curr: report.kpis.adSales, 
                                        prev: previousReport?.kpis.adSales, 
                                        fmt: fmt$, 
                                        good: "up",
                                        tooltip: "Total gross revenue generated directly from customer purchases following an Amazon Ad click." 
                                    },
                                    { 
                                        label: "Ad Spend", 
                                        curr: report.kpis.adSpend, 
                                        prev: previousReport?.kpis.adSpend, 
                                        fmt: fmt$, 
                                        good: "down",
                                        tooltip: "Total advertising budget spent across all Amazon Sponsored Products, Brands, and Display campaigns." 
                                    },
                                    { 
                                        label: "ACoS", 
                                        curr: report.kpis.acos, 
                                        prev: previousReport?.kpis.acos, 
                                        fmt: fmtPct, 
                                        good: "down", 
                                        cls: acosClass(report.kpis.acos),
                                        tooltip: "Advertising Cost of Sales = (Ad Spend ÷ Ad Sales) × 100. Lower is more profitable. E.g., 20% means $0.20 spent per $1.00 ad revenue." 
                                    },
                                    { 
                                        label: "ROAS", 
                                        curr: report.kpis.roas, 
                                        prev: previousReport?.kpis.roas, 
                                        fmt: fmtX, 
                                        good: "up", 
                                        cls: roasClass(report.kpis.roas),
                                        tooltip: "Return on Ad Spend = Ad Sales ÷ Ad Spend. Higher is better. E.g., 4.0x means $4.00 earned for every $1.00 spent on ads." 
                                    },
                                    { 
                                        label: "Orders", 
                                        curr: report.kpis.orders, 
                                        prev: previousReport?.kpis.orders, 
                                        fmt: fmtN, 
                                        good: "up",
                                        tooltip: "Total converted purchase orders directly attributed to an Amazon ad click." 
                                    },
                                    { 
                                        label: "CTR", 
                                        curr: report.kpis.ctr, 
                                        prev: previousReport?.kpis.ctr, 
                                        fmt: fmtPct, 
                                        good: "up",
                                        tooltip: "Click-Through Rate = (Clicks ÷ Impressions) × 100. Percentage of shoppers who viewed the ad and clicked into the listing." 
                                    },
                                    { 
                                        label: "CVR", 
                                        curr: report.kpis.cvr, 
                                        prev: previousReport?.kpis.cvr, 
                                        fmt: fmtPct, 
                                        good: "up",
                                        tooltip: "Conversion Rate = (Orders ÷ Clicks) × 100. Percentage of ad clicks that resulted in a completed order." 
                                    },
                                    { 
                                        label: "Avg CPC", 
                                        curr: report.kpis.avgCpc, 
                                        prev: previousReport?.kpis.avgCpc, 
                                        fmt: fmt$, 
                                        good: "down",
                                        tooltip: "Average Cost Per Click = Total Spend ÷ Total Clicks. The average fee paid to Amazon per shopper click." 
                                    },
                                ] as { label: string; curr: number | null; prev?: number | null; fmt: (v: number | null | undefined) => string; good: 'up' | 'down'; cls?: string; tooltip: string }[]).map(({ label, curr, prev, fmt: fmtFn, good, cls, tooltip }) => {
                                    const change = curr != null && prev != null && prev !== 0
                                        ? ((curr - prev) / Math.abs(prev)) * 100
                                        : null;
                                    const isPositive = change != null && ((good === 'up' && change > 0) || (good === 'down' && change < 0));
                                    const isNegative = change != null && ((good === 'up' && change < 0) || (good === 'down' && change > 0));

                                    return (
                                        <Tooltip key={label}>
                                            <TooltipTrigger asChild>
                                                <div className="bg-muted/40 rounded-lg p-3 text-center border border-border/40 hover:border-orange-500/40 hover:bg-muted/60 transition-colors cursor-help group">
                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">{label}</p>
                                                        <HelpCircle className="h-2.5 w-2.5 opacity-30 group-hover:opacity-100 text-orange-400 transition-opacity" />
                                                    </div>
                                                    <p className={`text-base font-bold ${cls ?? ""}`}>{fmtFn(curr)}</p>
                                                    {prev != null && (
                                                        <div className="mt-1.5 pt-1.5 border-t border-border/30 space-y-0.5">
                                                            <p className="text-[9px] text-muted-foreground">prev: {fmtFn(prev)}</p>
                                                            {change != null && change !== 0 && (
                                                                <div className={`flex items-center justify-center gap-0.5 text-[10px] font-semibold ${
                                                                    isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-muted-foreground'
                                                                }`}>
                                                                    {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                                    <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[260px] text-xs p-2.5">
                                                <p className="font-semibold text-foreground mb-1">{label}</p>
                                                <p className="text-muted-foreground leading-relaxed">{tooltip}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        </TooltipProvider>

                        {/* Metric Explanatory Note */}
                        <div className="bg-muted/20 border border-border/40 rounded-lg px-3 py-2 text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5">
                                <Info className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                                <span className="font-medium text-foreground">Terms Guide:</span>
                                <span>Hover any metric card for formula.</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground/80">
                                <span><strong>ACoS:</strong> Lower = More Profit</span>
                                <span>•</span>
                                <span><strong>ROAS:</strong> Higher = Better Return</span>
                                <span>•</span>
                                <span><strong>CVR:</strong> % Clicks Buying</span>
                                <span>•</span>
                                <span><strong>CPC:</strong> Cost Per Click</span>
                            </div>
                        </div>

                        {/* Week-over-Week Progress Table */}
                        {(week1Totals || previousReport) && (() => {
                            // Compute W1 KPIs from week1Totals if available, else fallback to previousReport
                            const w1kpis = week1Totals ? {
                                adSales: week1Totals.sales,
                                adSpend: week1Totals.spend,
                                orders: week1Totals.orders,
                                acos: week1Totals.sales > 0 ? (week1Totals.spend / week1Totals.sales) * 100 : null,
                                roas: week1Totals.spend > 0 ? week1Totals.sales / week1Totals.spend : null,
                                cvr: week1Totals.clicks > 0 ? (week1Totals.orders / week1Totals.clicks) * 100 : null,
                            } : previousReport ? {
                                adSales: previousReport.kpis.adSales,
                                adSpend: previousReport.kpis.adSpend,
                                orders: previousReport.kpis.orders,
                                acos: previousReport.kpis.acos,
                                roas: previousReport.kpis.roas,
                                cvr: previousReport.kpis.cvr,
                            } : null;

                            if (!w1kpis) return null;

                            return (
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-sky-400">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Week-over-Week Progress</span>
                                </div>
                                <div className="rounded-lg border border-border/40 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="pl-4 text-xs">Metric</TableHead>
                                                <TableHead className="text-right text-xs">Week 1</TableHead>
                                                <TableHead className="text-right text-xs">Week 2</TableHead>
                                                <TableHead className="text-right pr-4 text-xs">Change</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {([
                                                { metric: 'Ad Sales', w1: w1kpis.adSales, w2: report.kpis.adSales, fmt: fmt$, unit: '%' as const, good: 'up' },
                                                { metric: 'Ad Spend', w1: w1kpis.adSpend, w2: report.kpis.adSpend, fmt: fmt$, unit: '%' as const, good: 'down' },
                                                { metric: 'Orders', w1: w1kpis.orders, w2: report.kpis.orders, fmt: fmtN, unit: '%' as const, good: 'up' },
                                                { metric: 'ACoS', w1: w1kpis.acos, w2: report.kpis.acos, fmt: fmtPct, unit: 'pts' as const, good: 'down' },
                                                { metric: 'ROAS', w1: w1kpis.roas, w2: report.kpis.roas, fmt: fmtX, unit: '%' as const, good: 'up' },
                                                { metric: 'CVR', w1: w1kpis.cvr, w2: report.kpis.cvr, fmt: fmtPct, unit: 'pts' as const, good: 'up' },
                                            ]).map((r) => {
                                                let changeStr = '\u2014';
                                                let changeClass = 'text-muted-foreground';
                                                if (r.w1 != null && r.w2 != null) {
                                                    if (r.unit === 'pts') {
                                                        const diff = r.w2 - r.w1;
                                                        const isGood = r.good === 'up' ? diff > 0 : diff < 0;
                                                        const isBad = r.good === 'up' ? diff < 0 : diff > 0;
                                                        changeStr = `${diff > 0 ? '+' : ''}${diff.toFixed(2)} pts`;
                                                        changeClass = isGood ? 'text-emerald-400 bg-emerald-500/5' : isBad ? 'text-red-400 bg-red-500/5' : 'text-muted-foreground';
                                                    } else if (r.w1 !== 0) {
                                                        const pct = ((r.w2 - r.w1) / Math.abs(r.w1)) * 100;
                                                        const isGood = r.good === 'up' ? pct > 0 : pct < 0;
                                                        const isBad = r.good === 'up' ? pct < 0 : pct > 0;
                                                        changeStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                                                        changeClass = isGood ? 'text-emerald-400 bg-emerald-500/5' : isBad ? 'text-red-400 bg-red-500/5' : 'text-muted-foreground';
                                                    }
                                                }
                                                return (
                                                    <TableRow key={r.metric} className="hover:bg-muted/20">
                                                        <TableCell className="pl-4 text-xs font-medium">{r.metric}</TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">{r.fmt(r.w1)}</TableCell>
                                                        <TableCell className="text-right text-xs font-medium">{r.fmt(r.w2)}</TableCell>
                                                        <TableCell className={`text-right pr-4 text-xs font-semibold ${changeClass}`}>
                                                            {changeStr}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                            );
                        })()}

                        {/* High-Level Weekly Reporting: What's Working, What's Not, Strategies */}
                        {(() => {
                            const { whatsWorking, whatsNotWorking, strategies } = deriveHighLevelInsights(
                                report,
                                previousReport,
                                report.week1Totals ?? week1Totals,
                            );
                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Target className="h-4 w-4 text-orange-400" />
                                            <span className="font-semibold text-sm">High-Level Weekly Report</span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400">
                                            Executive Breakdown
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        {/* 1. What's Working This Week */}
                                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2 text-emerald-400">
                                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                        <span className="font-semibold text-sm">What&apos;s Working This Week</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                                                        Wins
                                                    </Badge>
                                                </div>
                                                <ul className="space-y-2">
                                                    {whatsWorking.length > 0 ? whatsWorking.map((item, i) => (
                                                        <li key={i} className="text-xs text-foreground/85 flex gap-2 leading-relaxed">
                                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-400" />
                                                            <span>{item}</span>
                                                        </li>
                                                    )) : (
                                                        <li className="text-xs text-muted-foreground">No profitable campaigns recorded in this period.</li>
                                                    )}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* 2. What's Not Working */}
                                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2 text-red-400">
                                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                                        <span className="font-semibold text-sm">What&apos;s Not Working</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400 bg-red-500/10">
                                                        Bleeders
                                                    </Badge>
                                                </div>
                                                <ul className="space-y-2">
                                                    {whatsNotWorking.length > 0 ? whatsNotWorking.map((item, i) => (
                                                        <li key={i} className="text-xs text-foreground/85 flex gap-2 leading-relaxed">
                                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-red-400" />
                                                            <span>{item}</span>
                                                        </li>
                                                    )) : (
                                                        <li className="text-xs text-muted-foreground">No major budget bleeders detected in this period.</li>
                                                    )}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* 3. Strategies */}
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2 text-amber-400">
                                                        <Lightbulb className="h-4 w-4 shrink-0" />
                                                        <span className="font-semibold text-sm">Strategies</span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                                                        Playbook
                                                    </Badge>
                                                </div>
                                                <ol className="space-y-2">
                                                    {strategies.length > 0 ? strategies.map((item, i) => (
                                                        <li key={i} className="text-xs text-foreground/85 flex gap-2 leading-relaxed">
                                                            <span className="shrink-0 font-bold text-amber-400 w-4">{i + 1}.</span>
                                                            <span>{item}</span>
                                                        </li>
                                                    )) : (
                                                        <li className="text-xs text-muted-foreground">Maintain current bidding and targeting controls.</li>
                                                    )}
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Executive Summary */}
                        {(report.executiveSummary?.length || 0) > 0 && (
                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3 text-blue-400">
                                    <Lightbulb className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Executive Summary</span>
                                </div>
                                <ul className="space-y-1.5">
                                    {report.executiveSummary?.map((b, i) => (
                                        <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-blue-500/70" />
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Client Needs to Know + Channel Snapshot */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {report.clientNeedsToKnow && (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-2 text-amber-400">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="font-semibold text-sm">What the Client Needs to Know</span>
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed">{report.clientNeedsToKnow}</p>
                                </div>
                            )}
                            {report.channelSnapshot && (
                                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-2 text-purple-400">
                                        <BarChart3 className="h-4 w-4" />
                                        <span className="font-semibold text-sm">Channel Snapshot</span>
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed">{report.channelSnapshot}</p>
                                </div>
                            )}
                        </div>

                        {/* Top Revenue Drivers Table */}
                        {(report.topRevenueCampaigns?.length || 0) > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Top Revenue Drivers</span>
                                </div>
                                <div className="rounded-lg border border-border/40 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="pl-4 text-xs">Campaign</TableHead>
                                                <TableHead className="text-right text-xs">Spend</TableHead>
                                                <TableHead className="text-right text-xs">Sales</TableHead>
                                                <TableHead className="text-right text-xs">ACoS</TableHead>
                                                <TableHead className="text-right text-xs">Orders</TableHead>
                                                <TableHead className="text-right pr-4 text-xs">ROAS</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {report.topRevenueCampaigns?.map((c, i) => (
                                                <TableRow key={i} className="hover:bg-muted/20">
                                                    <TableCell className="pl-4 text-xs font-medium max-w-[220px]">
                                                        <span className="truncate block" title={c.name}>{c.name}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">{fmt$(c.spend)}</TableCell>
                                                    <TableCell className="text-right text-xs font-medium">{fmt$(c.sales)}</TableCell>
                                                    <TableCell className={`text-right text-xs font-semibold ${acosClass(c.acos)}`}>
                                                        {fmtPct(c.acos)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">{c.orders}</TableCell>
                                                    <TableCell className={`text-right text-xs font-semibold pr-4 ${roasClass(c.roas)}`}>
                                                        {fmtX(c.roas)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Wasteful Search Terms Table */}
                        {(report.wastefulSearchTerms?.length || 0) > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-red-400">
                                    <TrendingDown className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Highest Spend Search Terms With No Sales</span>
                                </div>
                                <div className="rounded-lg border border-red-500/20 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-red-500/5">
                                                <TableHead className="pl-4 text-xs">Search Term</TableHead>
                                                <TableHead className="text-right text-xs">Clicks</TableHead>
                                                <TableHead className="text-right text-xs">Spend</TableHead>
                                                <TableHead className="text-right text-xs">Sales</TableHead>
                                                <TableHead className="pr-4 text-xs">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {report.wastefulSearchTerms?.map((t, i) => (
                                                <TableRow key={i} className="hover:bg-red-500/5">
                                                    <TableCell className="pl-4 text-xs font-medium">{t.term}</TableCell>
                                                    <TableCell className="text-right text-xs">{t.clicks}</TableCell>
                                                    <TableCell className="text-right text-xs font-semibold text-red-400">
                                                        {fmt$(t.spend)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {fmt$(t.sales)}
                                                    </TableCell>
                                                    <TableCell className="pr-4 text-xs text-muted-foreground">{t.action}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Action Plan */}
                        {(report.actionPlan?.length || 0) > 0 && (
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                                    <Target className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Action Plan for the Next 14 Days</span>
                                </div>
                                <ol className="space-y-2">
                                    {report.actionPlan?.map((action, i) => (
                                        <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                            <span className="shrink-0 font-bold text-emerald-400 w-4">{i + 1}.</span>
                                            {action}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Final Recommendation */}
                        {report.finalRecommendation && (
                            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 border-l-2 border-l-foreground/60">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                    Final Recommendation
                                </p>
                                <p className="text-sm text-foreground/90 leading-relaxed">{report.finalRecommendation}</p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
            )}
        </Card>
    );
}
