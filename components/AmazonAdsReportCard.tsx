"use client";

import { useState, useCallback, useRef } from "react";
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
    Target,
    TrendingDown,
    Crosshair,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
    kpis: AmazonKPIs;
    executiveSummary: string[];
    clientNeedsToKnow: string;
    channelSnapshot: string;
    topRevenueCampaigns: TopCampaign[];
    wastefulSearchTerms: WastefulTerm[];
    actionPlan: string[];
    finalRecommendation: string;
}

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

// ─── PDF print helper ─────────────────────────────────────────────────────────
function buildPrintHTML(data: AmazonReportData, clientName: string, fileName: string): string {
    const today = format(new Date(), "MMMM d, yyyy");

    const kpiRow = (label: string, value: string) =>
        `<div class="kpi-cell"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

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
  <p class="subtitle">Source file: ${fileName} &nbsp;|&nbsp; Generated: ${today}</p>

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

  ${data.executiveSummary.length > 0 ? `
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

  ${data.topRevenueCampaigns.length > 0 ? `
  <div class="section">
    <div class="section-title">Top Revenue Drivers</div>
    <table>
      <thead><tr><th>Campaign</th><th class="num">Spend</th><th class="num">Sales</th><th class="num">ACoS</th><th class="num">Orders</th><th class="num">ROAS</th></tr></thead>
      <tbody>${campaignRows}</tbody>
    </table>
  </div>` : ""}

  ${data.wastefulSearchTerms.length > 0 ? `
  <div class="section">
    <div class="section-title waste-header">Highest Spend Search Terms With No Sales</div>
    <table>
      <thead><tr><th>Search Term</th><th class="num">Clicks</th><th class="num">Spend</th><th class="num">Sales</th><th>Action</th></tr></thead>
      <tbody>${wasteRows}</tbody>
    </table>
  </div>` : ""}

  ${data.actionPlan.length > 0 ? `
  <div class="section">
    <div class="section-title">Action Plan for the Next 7 Days</div>
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
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<AmazonReportData | null>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const { toast } = useToast();
    const printFrameRef = useRef<HTMLIFrameElement | null>(null);

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

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) { setFile(f); setReport(null); }
    }, []);

    // ─── Analysis ────────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!file) {
            toast({ title: "No file selected", description: "Upload an Amazon Ads CSV or Excel report", variant: "destructive" });
            return;
        }

        setIsAnalyzing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const formData = new FormData();
            formData.append("clientId", clientId);
            formData.append("file", file);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-amazon-ads`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                    },
                    body: formData,
                }
            );

            if (!response.ok) {
                let errPayload: any = {};
                try { errPayload = await response.json(); } catch { /* not json */ }
                throw new Error(errPayload.error || `HTTP ${response.status}`);
            }

            const result: AmazonReportData = await response.json();
            setReport(result);
            setGeneratedAt(new Date());
            toast({ title: "Report ready!", description: "Your Amazon Ads report has been generated." });
        } catch (err: any) {
            toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ─── PDF Download ─────────────────────────────────────────────────────────
    const handleDownloadPDF = () => {
        if (!report || !file) return;

        const html = buildPrintHTML(report, clientName, file.name);

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
                </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
                {/* Upload Zone */}
                <div>
                    <div
                        className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center hover:border-orange-500/40 transition-colors cursor-pointer"
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
                            <div className="flex items-center justify-center gap-3">
                                <FileSpreadsheet className="h-5 w-5 text-orange-400" />
                                <span className="text-sm font-medium">{file.name}</span>
                                <Badge variant="secondary" className="text-[10px]">
                                    {(file.size / 1024).toFixed(1)} KB
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); setReport(null); }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <Upload className="h-6 w-6 mx-auto text-muted-foreground/60" />
                                <p className="text-sm text-muted-foreground">Drop your Amazon Ads report here or click to upload</p>
                                <p className="text-xs text-muted-foreground/60">
                                    Campaign Performance or Search Term reports (.csv, .xlsx)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 mt-3">
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
                                    onClick={() => { setReport(null); setFile(null); }}
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
                        <p className="text-xs mt-1 opacity-60">
                            Supports Campaign Performance and Search Term reports
                        </p>
                    </div>
                )}

                {/* Report Output */}
                {!isAnalyzing && report && (
                    <div className="space-y-5">

                        {/* KPI Bar */}
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                            {[
                                { label: "Ad Sales", value: fmt$(report.kpis.adSales) },
                                { label: "Ad Spend", value: fmt$(report.kpis.adSpend) },
                                { label: "ACoS", value: fmtPct(report.kpis.acos), className: acosClass(report.kpis.acos) },
                                { label: "ROAS", value: fmtX(report.kpis.roas), className: roasClass(report.kpis.roas) },
                                { label: "Orders", value: fmtN(report.kpis.orders) },
                                { label: "CTR", value: fmtPct(report.kpis.ctr) },
                                { label: "CVR", value: fmtPct(report.kpis.cvr) },
                                { label: "Avg CPC", value: fmt$(report.kpis.avgCpc) },
                            ].map(({ label, value, className }) => (
                                <div key={label} className="bg-muted/40 rounded-lg p-3 text-center border border-border/40">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                                    <p className={`text-base font-bold ${className ?? ""}`}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Executive Summary */}
                        {report.executiveSummary.length > 0 && (
                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3 text-blue-400">
                                    <Lightbulb className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Executive Summary</span>
                                </div>
                                <ul className="space-y-1.5">
                                    {report.executiveSummary.map((b, i) => (
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
                        {report.topRevenueCampaigns.length > 0 && (
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
                                            {report.topRevenueCampaigns.map((c, i) => (
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
                        {report.wastefulSearchTerms.length > 0 && (
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
                                            {report.wastefulSearchTerms.map((t, i) => (
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
                        {report.actionPlan.length > 0 && (
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                                    <Target className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Action Plan for the Next 7 Days</span>
                                </div>
                                <ol className="space-y-2">
                                    {report.actionPlan.map((action, i) => (
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
        </Card>
    );
}
