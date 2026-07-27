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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoogleCampaignRow {
    campaign: string;
    type: string;
    status: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    convValue: number;
}

interface GoogleDiagnosis {
    trafficSignal: string;
    conversionHealth: string;
    accountConstraint: string;
}

interface GoogleKeyIssue {
    area: string;
    currentSignal: string;
    recommendedMove: string;
    priority: string;
}

interface GoogleKPIs {
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    conversions: number | null;
    convValue: number | null;
    roas: number | null;
    costPerConv: number | null;
    avgCpc: number | null;
    interactionRate: number | null;
    campaignType: string;
    status: string;
}

interface GoogleReportData {
    sourceFileName?: string;
    kpis: GoogleKPIs;
    executiveSummary: string[];
    clientNeedsToKnow: string;
    campaignPerformance: GoogleCampaignRow[];
    diagnosis: GoogleDiagnosis;
    keyIssues: GoogleKeyIssue[];
    actionPlan: string[];
    finalRecommendation: string;
}

interface GoogleAdsReportCardProps {
    clientId: string;
    clientName: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (v: number | null | undefined) =>
    v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number | null | undefined) =>
    v == null ? "—" : `${v.toFixed(2)}%`;

const fmtX = (v: number | null | undefined) =>
    v == null ? "—" : `${v.toFixed(2)}x`;

const fmtN = (v: number | null | undefined) =>
    v == null ? "—" : v.toLocaleString();

// ─── Parse date range from bulk export filename ──────────────────────────────
// Pattern: bulk-XXXX-YYYYMMDD-YYYYMMDD-NNNNN.xlsx or similar
const parseDateRangeFromFilename = (filename: string): { from: string; to: string } | null => {
    const match = filename.match(/(\d{8})-(\d{8})/);
    if (!match) return null;
    const fromRaw = match[1];
    const toRaw = match[2];
    const from = `${fromRaw.substring(0, 4)}-${fromRaw.substring(4, 6)}-${fromRaw.substring(6, 8)}`;
    const to = `${toRaw.substring(0, 4)}-${toRaw.substring(4, 6)}-${toRaw.substring(6, 8)}`;
    return { from, to };
};

const priorityColor = (priority: string) => {
    switch (String(priority).toLowerCase()) {
        case "high": return "text-red-400 bg-red-500/10 border-red-500/20";
        case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
        default: return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    }
};

// ─── PDF print helper ─────────────────────────────────────────────────────────

function buildPrintHTML(data: GoogleReportData, clientName: string, fileName: string): string {
    const today = format(new Date(), "MMMM d, yyyy");
    const displayFileName = data.sourceFileName || fileName;

    const kpiRow = (label: string, value: string) =>
        `<div class="kpi-cell"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;

    const campaignRows = (data.campaignPerformance || [])
        .map(
            (c) => `
      <tr>
        <td>${c.campaign}</td>
        <td>${c.type}</td>
        <td>${c.status}</td>
        <td class="num">${fmt$(c.spend)}</td>
        <td class="num">${fmtN(c.impressions)}</td>
        <td class="num">${fmtN(c.clicks)}</td>
        <td class="num">${fmtPct(c.ctr)}</td>
        <td class="num">${fmtN(c.conversions)}</td>
        <td class="num">${fmt$(c.convValue)}</td>
      </tr>`
        )
        .join("");

    const keyIssuesRows = (data.keyIssues || [])
        .map(
            (issue) => `
      <tr>
        <td class="bold">${issue.area}</td>
        <td>${issue.currentSignal}</td>
        <td>${issue.recommendedMove}</td>
        <td><span class="badge badge-${issue.priority.toLowerCase()}">${issue.priority}</span></td>
      </tr>`
        )
        .join("");

    const executiveBullets = (data.executiveSummary || [])
        .map((b) => `<li>${b}</li>`)
        .join("");

    const actionBullets = (data.actionPlan || [])
        .map((b) => `<li>${b}</li>`)
        .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Google Ads Campaign Report — ${clientName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
    body {
      font-family: 'Outfit', sans-serif;
      background: #020617;
      color: #f8fafc;
      margin: 40px;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    header {
      border-bottom: 2px solid #334155;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #38bdf8;
      margin: 0;
      letter-spacing: -0.025em;
    }
    .meta-subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 5px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 25px;
    }
    .kpi-cell {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .kpi-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
    }
    .section {
      margin-bottom: 25px;
      background: #0b1329;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 18px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 12px;
      border-left: 3px solid #0ea5e9;
      padding-left: 8px;
    }
    .diagnosis-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .diagnosis-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 15px;
    }
    .diagnosis-card-title {
      font-size: 12px;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .diagnosis-card-text {
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      text-align: left;
      padding: 10px;
      border-bottom: 1px solid #1e293b;
    }
    th {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      font-weight: 600;
      background: #0f172a;
    }
    td {
      color: #cbd5e1;
      font-size: 12px;
    }
    .num {
      text-align: right;
    }
    .bold {
      font-weight: 600;
    }
    ul, ol {
      margin: 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
      color: #cbd5e1;
    }
    .badge {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-high { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
    .badge-medium { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }
    .badge-low { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.2); }
    .final-box {
      border-left: 3px solid #38bdf8;
      background: #0f172a;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
    }
    footer {
      text-align: center;
      font-size: 11px;
      color: #475569;
      margin-top: 40px;
      border-top: 1px solid #1e293b;
      padding-top: 15px;
    }
    @media print {
      body { background: #fff; color: #000; margin: 20px; }
      .kpi-cell, .section, .diagnosis-card, .final-box, th { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; color: #000 !important; }
      h1, .section-title, .diagnosis-card-title { color: #0ea5e9 !important; }
      td, li { color: #334155 !important; }
      .badge-high { background: #fef2f2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; }
      .badge-medium { background: #fffbeb !important; color: #d97706 !important; border: 1px solid #fcd34d !important; }
      .badge-low { background: #eff6ff !important; color: #2563eb !important; border: 1px solid #93c5fd !important; }
      th { color: #475569 !important; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${clientName} Google Ads Campaign Report</h1>
    <div class="meta-subtitle">Reporting window: ${today} &nbsp;|&nbsp; File: ${displayFileName}</div>
  </header>

  <div class="kpi-grid">
    ${kpiRow("Spend", fmt$(data.kpis.spend))}
    ${kpiRow("Impressions", fmtN(data.kpis.impressions))}
    ${kpiRow("Clicks", fmtN(data.kpis.clicks))}
    ${kpiRow("CTR", fmtPct(data.kpis.ctr))}
    ${kpiRow("Conversions", fmtN(data.kpis.conversions))}
    ${kpiRow("Conv. Value", fmt$(data.kpis.convValue))}
    ${kpiRow("ROAS", fmtX(data.kpis.roas))}
    ${kpiRow("Cost / Conv.", data.kpis.costPerConv == null ? "N/A" : fmt$(data.kpis.costPerConv))}
  </div>

  <div class="section">
    <div class="section-title">Executive Summary</div>
    <ul>${executiveBullets}</ul>
  </div>

  <div class="section">
    <div class="section-title">What the Client Needs to Know</div>
    <p>${data.clientNeedsToKnow}</p>
  </div>

  <div class="section">
    <div class="section-title">Google Ads Diagnosis</div>
    <div class="diagnosis-grid">
      <div class="diagnosis-card">
        <div class="diagnosis-card-title">Traffic Signal</div>
        <div class="diagnosis-card-text">${data.diagnosis.trafficSignal}</div>
      </div>
      <div class="diagnosis-card">
        <div class="diagnosis-card-title">Conversion Health</div>
        <div class="diagnosis-card-text">${data.diagnosis.conversionHealth}</div>
      </div>
      <div class="diagnosis-card">
        <div class="diagnosis-card-title">Account Constraint</div>
        <div class="diagnosis-card-text">${data.diagnosis.accountConstraint}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Campaign Performance</div>
    <table>
      <thead>
        <tr>
          <th>Campaign</th>
          <th>Type</th>
          <th>Status</th>
          <th class="num">Spend</th>
          <th class="num">Impr.</th>
          <th class="num">Clicks</th>
          <th class="num">CTR</th>
          <th class="num">Conv.</th>
          <th class="num">Value</th>
        </tr>
      </thead>
      <tbody>
        ${campaignRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Key Issues To Fix</div>
    <table>
      <thead>
        <tr>
          <th>Area</th>
          <th>Current Signal</th>
          <th>Recommended Move</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        ${keyIssuesRows}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Action Plan for the Next 14 Days</div>
    <ol>${actionBullets}</ol>
  </div>

  <div class="section">
    <div class="section-title">Final Recommendation</div>
    <div class="final-box">
      <p>${data.finalRecommendation}</p>
    </div>
  </div>

  <footer>Generated by Sienvi Agency Dashboard &nbsp;|&nbsp; ${today}</footer>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoogleAdsReportCard({ clientId, clientName }: GoogleAdsReportCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<GoogleReportData | null>(null);
    const [previousReport, setPreviousReport] = useState<GoogleReportData | null>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const hasTriggeredAnalysis = useRef(false);

    // Reset local state on client switch to prevent leaking/stuck report screens
    useEffect(() => {
        setFile(null);
        setReport(null);
        setPreviousReport(null);
        setGeneratedAt(null);
        setIsAnalyzing(false);
        hasTriggeredAnalysis.current = false;
    }, [clientId]);

    const { data: cachedData, refetch: refetchReport } = useQuery({
        queryKey: ["google-ads-report", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("google_ads_reports" as any)
                .select("parsed_data, generated_at, source_file_name, generation_status, report_period")
                .eq("client_id", clientId)
                .order("report_period", { ascending: false })
                .limit(2);

            if (error) throw error;
            return data as any[] || [];
        },
        enabled: !!clientId,
        refetchInterval: (query) => {
            const rows = query.state.data as any[] | undefined;
            return rows?.[0]?.generation_status === 'pending' ? 5000 : false;
        }
    });

    useEffect(() => {
        if (cachedData && cachedData.length > 0) {
            const latest = cachedData[0];
            const prev = cachedData.length > 1 ? cachedData[1] : null;

            if (latest.generation_status === 'pending') {
                setIsAnalyzing(true);
                hasTriggeredAnalysis.current = true;
            } else if (latest.generation_status === 'complete' && latest.parsed_data) {
                setIsAnalyzing(false);
                setReport(latest.parsed_data as GoogleReportData);
                if (latest.generated_at) {
                    setGeneratedAt(new Date(latest.generated_at));
                }
                if (latest.source_file_name && !file) {
                    setFile(new File([""], latest.source_file_name, { type: "text/csv" }));
                }
                if (prev?.generation_status === 'complete' && prev?.parsed_data) {
                    setPreviousReport(prev.parsed_data as GoogleReportData);
                }
            } else if (latest.generation_status === 'failed') {
                setIsAnalyzing(false);
                if (hasTriggeredAnalysis.current) {
                    toast({ title: "Analysis failed", description: "Background worker failed to process the report.", variant: "destructive" });
                    hasTriggeredAnalysis.current = false;
                }
            }
        }
    }, [cachedData, file, toast]);

    // ─── File handling ───────────────────────────────────────────────────────
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        if (![".csv", ".xlsx", ".xls"].includes(ext)) {
            toast({ title: "Invalid file", description: "Upload a .csv or .xlsx Google Ads report", variant: "destructive" });
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

    // ─── Parse file client-side ───────────────────────────────────────────────
    const parseFileClientSide = async (f: File): Promise<{ csvText: string; exactTotals: { spend: number; impressions: number; clicks: number; conversions: number; convValue: number }; fileName: string }> => {
        const arrayBuffer = await f.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const allText: string[] = [];
        let exactTotals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 };

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);

            // Compute exact totals from this sheet
            const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
            if (rows.length === 0) continue;
            const keys = Object.keys(rows[0]).map(k => k.trim());

            const findKey = (patterns: string[]) => keys.find(k => patterns.some(p => k.toLowerCase().includes(p) || k.toLowerCase() === p));
            const spendKey = findKey(['cost', 'spend']);
            const impressionsKey = findKey(['impr', 'impressions']);
            const clicksKey = findKey(['clicks']);
            const conversionsKey = findKey(['conversions', 'conv.', 'conv']);
            const convValueKey = findKey(['conv. value', 'conversion value', 'all conv. value', 'value', 'revenue', 'sales']);

            for (const row of rows) {
                const firstVal = String(Object.values(row)[0] || '').toLowerCase();
                if (firstVal.includes('total') || firstVal.includes('summary')) continue;

                const parse = (k?: string) => k && row[k] ? parseFloat(String(row[k]).replace(/,/g, '').replace(/\$/g, '')) || 0 : 0;
                exactTotals.spend += parse(spendKey);
                exactTotals.impressions += parse(impressionsKey);
                exactTotals.clicks += parse(clicksKey);
                exactTotals.conversions += parse(conversionsKey);
                exactTotals.convValue += parse(convValueKey);
            }
        }

        const MAX_CHARS = 50000;
        let csvText = allText.join('\n\n');
        if (csvText.length > MAX_CHARS) csvText = csvText.substring(0, MAX_CHARS) + '\n\n[... truncated ...]';

        return { csvText, exactTotals, fileName: f.name };
    };

    // ─── Analysis ────────────────────────────────────────────────────────────
    const handleAnalyze = async () => {
        if (!file) {
            toast({ title: "No file selected", description: "Upload a Google Ads CSV or Excel report", variant: "destructive" });
            return;
        }

        setIsAnalyzing(true);
        hasTriggeredAnalysis.current = true;
        try {
            const { data: { session } } = await supabase.auth.getSession();

            toast({ title: "Parsing file…", description: "Reading your report data" });
            const { csvText, exactTotals, fileName } = await parseFileClientSide(file);

            toast({ title: "Analyzing…", description: "Sending to AI for analysis" });
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-google-ads`,
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
                        reportPeriod: (() => { const dr = parseDateRangeFromFilename(fileName); return dr ? `${dr.from}_${dr.to}` : new Date().toISOString().substring(0, 7); })(),
                        dateRange: parseDateRangeFromFilename(fileName),
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
                toast({ title: "Report ready!", description: "Your Google Ads report has been generated." });
            } else {
                toast({ title: "Processing", description: "Report is being processed." });
            }

            queryClient.invalidateQueries({ queryKey: ["google-ads-report", clientId] });

        } catch (err: any) {
            toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
            setIsAnalyzing(false);
        }
    };

    // ─── PDF Download ─────────────────────────────────────────────────────────
    const handleDownloadPDF = () => {
        if (!report) return;

        const html = buildPrintHTML(report, clientName, file?.name || report.sourceFileName || "Cached Report");

        const win = window.open("", "_blank", "width=960,height=800");
        if (!win) {
            toast({ title: "Popup blocked", description: "Allow popups and try again.", variant: "destructive" });
            return;
        }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 400);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500/20 to-blue-500/20">
                        <BarChart3 className="h-5 w-5 text-sky-400" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            Google Ads Campaign Report
                            <Badge variant="secondary" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/20">
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
                            className="border-2 border-dashed border-border/60 rounded-lg p-4 text-center hover:border-sky-500/40 transition-colors cursor-pointer"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById(`google-upload-${clientId}`)?.click()}
                        >
                            <input
                                id={`google-upload-${clientId}`}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center justify-center gap-3">
                                    <FileSpreadsheet className="h-5 w-5 text-sky-400" />
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
                                    <p className="text-sm text-muted-foreground">Drop your Google Ads report here or click to upload</p>
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
                                className="h-8 text-xs bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700"
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
                                        className="h-8 text-xs border-sky-500/40 text-sky-400 hover:text-sky-300 hover:border-sky-500/60"
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
                                            await supabase.from("google_ads_reports" as any).delete().eq("client_id", clientId);
                                            queryClient.invalidateQueries({ queryKey: ["google-ads-report", clientId] });
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
                                <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />
                                Crunching your Google Ads data…
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
                            <p className="text-sm">Upload a Google Ads report and click Generate</p>
                            <p className="text-xs mt-1 opacity-60 mb-2">
                                Supports Campaign Performance and Search Term reports
                            </p>
                            {cachedData?.generation_status === 'failed' && (
                                <p className="text-xs mt-2 text-red-400 bg-red-500/10 py-1.5 px-3 rounded border border-red-500/20 inline-block font-medium">
                                    Previous analysis failed. Please try re-uploading the report.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Report Output */}
                    {!isAnalyzing && report && (
                        <div className="space-y-5">

                            {/* KPI Bar — with comparison if previous report exists */}
                            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                                {([
                                    { label: "Spend", curr: report.kpis.spend, prev: previousReport?.kpis.spend, fmt: fmt$, good: "down" as const },
                                    { label: "Impressions", curr: report.kpis.impressions, prev: previousReport?.kpis.impressions, fmt: fmtN, good: "up" as const },
                                    { label: "Clicks", curr: report.kpis.clicks, prev: previousReport?.kpis.clicks, fmt: fmtN, good: "up" as const },
                                    { label: "CTR", curr: report.kpis.ctr, prev: previousReport?.kpis.ctr, fmt: fmtPct, good: "up" as const },
                                    { label: "Conversions", curr: report.kpis.conversions, prev: previousReport?.kpis.conversions, fmt: fmtN, good: "up" as const },
                                    { label: "Conv. Value", curr: report.kpis.convValue, prev: previousReport?.kpis.convValue, fmt: fmt$, good: "up" as const },
                                    { label: "ROAS", curr: report.kpis.roas, prev: previousReport?.kpis.roas, fmt: fmtX, good: "up" as const, cls: roasClass(report.kpis.roas) },
                                    { label: "Cost / Conv.", curr: report.kpis.costPerConv, prev: previousReport?.kpis.costPerConv, fmt: (v: number | null | undefined) => v == null ? "N/A" : fmt$(v), good: "down" as const },
                                ]).map(({ label, curr, prev, fmt: fmtFn, good, cls }) => {
                                    const change = curr != null && prev != null && prev !== 0
                                        ? ((curr - prev) / Math.abs(prev)) * 100
                                        : null;
                                    const isPositive = change != null && ((good === 'up' && change > 0) || (good === 'down' && change < 0));
                                    const isNegative = change != null && ((good === 'up' && change < 0) || (good === 'down' && change > 0));

                                    return (
                                        <div key={label} className="bg-muted/40 rounded-lg p-3 text-center border border-border/40">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
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
                                    );
                                })}
                            </div>

                            {/* Executive Summary */}
                            {(report.executiveSummary?.length || 0) > 0 && (
                                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-3 text-sky-400">
                                        <Lightbulb className="h-4 w-4" />
                                        <span className="font-semibold text-sm">Executive Summary</span>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {report.executiveSummary?.map((b, i) => (
                                            <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-sky-500/70" />
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Client Needs to Know */}
                            {report.clientNeedsToKnow && (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                                    <div className="flex items-center gap-2 mb-2 text-amber-400">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span className="font-semibold text-sm">What the Client Needs to Know</span>
                                    </div>
                                    <p className="text-xs text-foreground/80 leading-relaxed">{report.clientNeedsToKnow}</p>
                                </div>
                            )}

                            {/* Google Ads Diagnosis (3 Cards) */}
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-sky-400">
                                    <BarChart3 className="h-4 w-4" />
                                    <span className="font-semibold text-sm">Google Ads Diagnosis</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-muted/30 border border-border/40 rounded-lg p-3">
                                        <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-wide mb-1">Traffic Signal</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{report.diagnosis.trafficSignal}</p>
                                    </div>
                                    <div className="bg-muted/30 border border-border/40 rounded-lg p-3">
                                        <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide mb-1">Conversion Health</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{report.diagnosis.conversionHealth}</p>
                                    </div>
                                    <div className="bg-muted/30 border border-border/40 rounded-lg p-3">
                                        <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-1">Account Constraint</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{report.diagnosis.accountConstraint}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Campaign Performance Table */}
                            {(report.campaignPerformance?.length || 0) > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-sky-400">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="font-semibold text-sm">Campaign Performance</span>
                                    </div>
                                    <div className="rounded-lg border border-border/40 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30">
                                                    <TableHead className="pl-4 text-xs">Campaign</TableHead>
                                                    <TableHead className="text-xs">Type</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                    <TableHead className="text-right text-xs">Spend</TableHead>
                                                    <TableHead className="text-right text-xs">Impr.</TableHead>
                                                    <TableHead className="text-right text-xs">Clicks</TableHead>
                                                    <TableHead className="text-right text-xs">CTR</TableHead>
                                                    <TableHead className="text-right text-xs">Conv.</TableHead>
                                                    <TableHead className="text-right pr-4 text-xs">Value</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {report.campaignPerformance?.map((c, i) => (
                                                    <TableRow key={i} className="hover:bg-muted/20">
                                                        <TableCell className="pl-4 text-xs font-medium max-w-[220px]">
                                                            <span className="truncate block" title={c.campaign}>{c.campaign}</span>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{c.type}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{c.status}</TableCell>
                                                        <TableCell className="text-right text-xs">{fmt$(c.spend)}</TableCell>
                                                        <TableCell className="text-right text-xs">{fmtN(c.impressions)}</TableCell>
                                                        <TableCell className="text-right text-xs">{fmtN(c.clicks)}</TableCell>
                                                        <TableCell className="text-right text-xs">{fmtPct(c.ctr)}</TableCell>
                                                        <TableCell className="text-right text-xs">{fmtN(c.conversions)}</TableCell>
                                                        <TableCell className="text-right text-xs pr-4 font-medium">{fmt$(c.convValue)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Key Issues To Fix Table */}
                            {(report.keyIssues?.length || 0) > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-sky-400">
                                        <TrendingDown className="h-4 w-4" />
                                        <span className="font-semibold text-sm">Key Issues To Fix</span>
                                    </div>
                                    <div className="rounded-lg border border-border/40 overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30">
                                                    <TableHead className="pl-4 text-xs">Area</TableHead>
                                                    <TableHead className="text-xs">Current Signal</TableHead>
                                                    <TableHead className="text-xs">Recommended Move</TableHead>
                                                    <TableHead className="pr-4 text-xs text-right">Priority</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {report.keyIssues?.map((issue, i) => (
                                                    <TableRow key={i} className="hover:bg-muted/20">
                                                        <TableCell className="pl-4 text-xs font-semibold">{issue.area}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{issue.currentSignal}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{issue.recommendedMove}</TableCell>
                                                        <TableCell className="pr-4 text-xs text-right">
                                                            <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 ${priorityColor(issue.priority)}`}>
                                                                {issue.priority}
                                                            </Badge>
                                                        </TableCell>
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
                                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 border-l-2 border-l-sky-500/60">
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

// ─── ROAS colour helper ───────────────────────────────────────────────────────
const roasClass = (roas: number | null) => {
    if (roas == null) return "";
    if (roas >= 4) return "text-emerald-400";
    if (roas >= 2) return "text-amber-400";
    return "text-red-400";
};
