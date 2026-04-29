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
    Crosshair,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WinningProduct {
    name: string;
    revenue: number;
    spend: number;
    roas: number;
    orders: number;
}

interface TikTokKPIs {
    spend: number | null;
    revenue: number | null;
    orders: number | null;
    roas: number | null;
}

interface TikTokReportData {
    sourceFileName?: string;
    performanceSnapshot: TikTokKPIs;
    summary: string;
    mainTakeaway: string;
    spendSplit?: {
        convertingProductsSpend: number;
        nonConvertingProductsSpend: number;
    };
    winningProducts: WinningProduct[];
}

interface TikTokAdsReportCardProps {
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
function buildPrintHTML(data: TikTokReportData, clientName: string, fileName: string): string {
    const today = format(new Date(), "MMMM d, yyyy");
    const displayFileName = data.sourceFileName || fileName;

    const kpiRow = (label: string, value: string) =>
        `<div class="kpi-cell"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

    const productRows = data.winningProducts.map((c) => `
        <tr>
            <td>${c.name}</td>
            <td class="num">$${c.spend.toFixed(2)}</td>
            <td class="num">$${c.revenue.toFixed(2)}</td>
            <td class="num">${c.orders}</td>
            <td class="num ${c.roas >= 4 ? "green" : c.roas >= 2 ? "amber" : "red"}">${c.roas.toFixed(2)}x</td>
        </tr>`).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>TikTok Ads Report — ${clientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 32px; max-width: 900px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
  .subtitle { font-size: 11px; color: #555; margin-bottom: 20px; }
  .kpi-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f4f4f8; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
  .kpi-cell { text-align: center; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #666; margin-bottom: 3px; }
  .kpi-value { font-size: 15px; font-weight: 700; color: #111; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1.5px solid #e2e2e2; padding-bottom: 4px; margin-bottom: 8px; color: #333; }
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
  footer { margin-top: 24px; font-size: 9px; color: #999; border-top: 1px solid #e2e2e2; padding-top: 8px; }
  @media print {
    body { padding: 20px; }
    @page { size: A4; margin: 15mm; }
  }
</style>
</head>
<body>
  <h1>TikTok Ads Report — ${clientName}</h1>
  <p class="subtitle">Source file: ${displayFileName} &nbsp;|&nbsp; Generated: ${today}</p>

  <div class="kpi-bar">
    ${kpiRow("Revenue", fmt$(data.performanceSnapshot.revenue))}
    ${kpiRow("Spend", fmt$(data.performanceSnapshot.spend))}
    ${kpiRow("ROAS", fmtX(data.performanceSnapshot.roas))}
    ${kpiRow("Orders", fmtN(data.performanceSnapshot.orders))}
  </div>

  ${data.summary ? `
  <div class="section">
    <div class="section-title">Summary</div>
    <p>${data.summary}</p>
  </div>` : ""}

  ${data.mainTakeaway ? `
  <div class="section">
    <div class="section-title">Main Takeaway</div>
    <div class="final-box"><p>${data.mainTakeaway}</p></div>
  </div>` : ""}

  ${data.spendSplit ? `
  <div class="section">
    <div class="section-title">Spend Split by Converting Status</div>
    <div style="margin-top: 10px; border: 1px solid #ececec; padding: 10px; border-radius: 6px;">
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
          <span>Products without orders</span>
          <span style="font-weight: 600;">$${data.spendSplit.nonConvertingProductsSpend.toFixed(2)}</span>
        </div>
        <div style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: #cbd5e1; width: ${(data.spendSplit.nonConvertingProductsSpend / ((data.spendSplit.convertingProductsSpend + data.spendSplit.nonConvertingProductsSpend) || 1)) * 100}%; height: 100%;"></div>
        </div>
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
          <span>Products with orders</span>
          <span style="font-weight: 600; color: #16a34a;">$${data.spendSplit.convertingProductsSpend.toFixed(2)}</span>
        </div>
        <div style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: #16a34a; width: ${(data.spendSplit.convertingProductsSpend / ((data.spendSplit.convertingProductsSpend + data.spendSplit.nonConvertingProductsSpend) || 1)) * 100}%; height: 100%;"></div>
        </div>
      </div>
    </div>
  </div>` : ""}

  ${data.winningProducts && data.winningProducts.length > 0 ? `
  <div class="section">
    <div class="section-title">Revenue by Winning Product</div>
    <div style="margin-top: 10px; border: 1px solid #ececec; padding: 10px; border-radius: 6px;">
      ${data.winningProducts.map(p => {
        const maxRev = Math.max(...data.winningProducts.map(w => w.revenue));
        const pct = (p.revenue / (maxRev || 1)) * 100;
        return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${p.name}</span>
            <span style="font-weight: 600; color: #111;">$${p.revenue.toFixed(2)}</span>
          </div>
          <div style="background: #f0f0f0; height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: #f43f5e; width: ${pct}%; height: 100%;"></div>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Winning Products</div>
    <table>
      <thead><tr><th>Product Name</th><th class="num">Spend</th><th class="num">Revenue</th><th class="num">Orders</th><th class="num">ROAS</th></tr></thead>
      <tbody>${productRows}</tbody>
    </table>
  </div>` : ""}

  <footer>Generated by Sienvi Agency Dashboard &nbsp;|&nbsp; ${today}</footer>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TikTokAdsReportCard({ clientId, clientName }: TikTokAdsReportCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<TikTokReportData | null>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: cachedData, isLoading: isFetchingCache, refetch: refetchReport } = useQuery({
        queryKey: ["tiktok-ads-report", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("ads_analytics_summaries" as any)
                .select("summary_data, generated_at, file_name")
                .eq("client_id", clientId)
                .eq("type", "tiktok")
                .order("generated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data as any;
        },
        enabled: !!clientId,
    });

    useEffect(() => {
        if (cachedData && cachedData.summary_data && cachedData.summary_data.performanceSnapshot) {
            setIsAnalyzing(false);
            setReport(cachedData.summary_data as TikTokReportData);
            if (cachedData.generated_at) {
                setGeneratedAt(new Date(cachedData.generated_at));
            }
            if (cachedData.file_name && !file) {
                setFile(new File([""], cachedData.file_name, { type: "text/csv" }));
            }
        }
    }, [cachedData, file, toast]);

    // ─── File handling ───────────────────────────────────────────────────────
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        if (![".csv", ".xlsx", ".xls"].includes(ext)) {
            toast({ title: "Invalid file", description: "Upload a .csv or .xlsx TikTok Ads report", variant: "destructive" });
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
            toast({ title: "No file selected", description: "Upload a TikTok Ads CSV or Excel report", variant: "destructive" });
            return;
        }

        setIsAnalyzing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const formData = new FormData();
            formData.append("clientId", clientId);
            formData.append("adPlatform", "tiktok");
            formData.append("file", file);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-ads-summary`,
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

            const result = await response.json();
            
            setReport(result);
            setGeneratedAt(new Date());
            toast({ title: "Report ready!", description: "Your TikTok Ads report has been generated and saved." });
            
            queryClient.invalidateQueries({ queryKey: ["tiktok-ads-report", clientId] });

        } catch (err: any) {
            toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
            setIsAnalyzing(false);
        }
    };

    // ─── PDF Download ─────────────────────────────────────────────────────────
    const handleDownloadPDF = () => {
        if (!report) return;

        const html = buildPrintHTML(report, clientName, file?.name || report.sourceFileName || "Cached Report");

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
                    <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20">
                        <BarChart3 className="h-5 w-5 text-pink-400" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            TikTok Ads Report
                            <Badge variant="secondary" className="text-[10px] bg-pink-500/10 text-pink-400 border-pink-500/20">
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
                    {/* Upload Zone */}
                <div>
                    <div
                        className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center hover:border-pink-500/40 transition-colors cursor-pointer"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById(`tiktok-upload-${clientId}`)?.click()}
                    >
                        <input
                            id={`tiktok-upload-${clientId}`}
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
                                <p className="text-sm text-muted-foreground">Drop your TikTok Ads report here or click to upload</p>
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
                            className="h-8 text-xs bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
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
                                        await supabase.from("ads_analytics_summaries" as any).delete().eq("client_id", clientId).eq("type", "tiktok");
                                        queryClient.invalidateQueries({ queryKey: ["tiktok-ads-report", clientId] });
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
                            <RefreshCw className="h-4 w-4 animate-spin text-pink-400" />
                            Crunching your TikTok data…
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
                        <p className="text-sm">Upload a TikTok Ads report and click Generate</p>
                        <p className="text-xs mt-1 opacity-60">
                            Supports Campaign Performance reports
                        </p>
                    </div>
                )}

                {/* Report Output */}
                {!isAnalyzing && report && (
                    <div className="space-y-5">

                        {/* KPI Bar */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { label: "Revenue", value: fmt$(report.performanceSnapshot.revenue) },
                                { label: "Spend", value: fmt$(report.performanceSnapshot.spend) },
                                { label: "ROAS", value: fmtX(report.performanceSnapshot.roas), className: roasClass(report.performanceSnapshot.roas) },
                                { label: "Orders", value: fmtN(report.performanceSnapshot.orders) },
                            ].map(({ label, value, className }) => (
                                <div key={label} className="bg-muted/40 rounded-lg p-3 text-center border border-border/40">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                                    <p className={`text-base font-bold ${className ?? ""}`}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Summary */}
                        {report.summary && (
                            <div className="rounded-lg border border-pink-500/20 bg-pink-500/5 p-4">
                                <div className="flex items-center gap-2 mb-3 text-pink-400">
                                    <Lightbulb className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Summary</span>
                                </div>
                                <p className="text-xs text-foreground/80 leading-relaxed">{report.summary}</p>
                            </div>
                        )}

                        {/* Main Takeaway */}
                        {report.mainTakeaway && (
                            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                                <div className="flex items-center gap-2 mb-2 text-purple-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Main Takeaway</span>
                                </div>
                                <p className="text-xs text-foreground/80 leading-relaxed">{report.mainTakeaway}</p>
                            </div>
                        )}

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Spend Split Chart */}
                            {report.spendSplit && (
                                <div className="rounded-lg border border-border/40 bg-card p-4">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Spend split by converting status</h4>
                                    <div className="h-[180px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={[
                                                    { name: 'Products without orders', spend: report.spendSplit.nonConvertingProductsSpend, fill: '#94a3b8' },
                                                    { name: 'Products with orders', spend: report.spendSplit.convertingProductsSpend, fill: '#10b981' }
                                                ]}
                                                layout="vertical"
                                                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                                            >
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={130} tick={{ fontSize: 11, fill: '#64748b' }} />
                                                <Tooltip 
                                                    cursor={{ fill: 'transparent' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-background border border-border/50 shadow-md rounded-md p-2 text-xs">
                                                                    <span className="font-medium">{payload[0].payload.name}: </span>
                                                                    <span className="font-bold text-foreground">${Number(payload[0].value).toFixed(2)}</span>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="spend" radius={[0, 4, 4, 0]} barSize={24}>
                                                    {
                                                        [0, 1].map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#94a3b8' : '#10b981'} />
                                                        ))
                                                    }
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Revenue by Winning Product Chart */}
                            {report.winningProducts && report.winningProducts.length > 0 && (
                                <div className="rounded-lg border border-border/40 bg-card p-4">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Revenue by winning product</h4>
                                    <div className="h-[180px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={report.winningProducts.slice(0, 5).map(p => ({
                                                    name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
                                                    fullName: p.name,
                                                    revenue: p.revenue
                                                }))}
                                                layout="vertical"
                                                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                                            >
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={130} tick={{ fontSize: 11, fill: '#64748b' }} />
                                                <Tooltip 
                                                    cursor={{ fill: 'transparent' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            return (
                                                                <div className="bg-background border border-border/50 shadow-md rounded-md p-2 text-xs max-w-[200px]">
                                                                    <div className="font-medium mb-1 line-clamp-2">{payload[0].payload.fullName}</div>
                                                                    <div className="font-bold text-rose-500">${Number(payload[0].value).toFixed(2)}</div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="revenue" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 10, formatter: (val: number) => `$${val.toFixed(2)}` }} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Winning Products Table */}
                        {report.winningProducts && report.winningProducts.length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-emerald-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Winning Products</span>
                                </div>
                                <div className="rounded-lg border border-border/40 overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead className="pl-4 text-xs">Product Name</TableHead>
                                                <TableHead className="text-right text-xs">Spend</TableHead>
                                                <TableHead className="text-right text-xs">Revenue</TableHead>
                                                <TableHead className="text-right text-xs">Orders</TableHead>
                                                <TableHead className="text-right pr-4 text-xs">ROAS</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {report.winningProducts.map((c, i) => (
                                                <TableRow key={i} className="hover:bg-muted/20">
                                                    <TableCell className="pl-4 text-xs font-medium max-w-[220px]">
                                                        <span className="truncate block" title={c.name}>{c.name}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">{fmt$(c.spend)}</TableCell>
                                                    <TableCell className="text-right text-xs font-medium">{fmt$(c.revenue)}</TableCell>
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
                    </div>
                )}
            </CardContent>
            )}
        </Card>
    );
}
