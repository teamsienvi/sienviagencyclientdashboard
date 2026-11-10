"use client";

import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, FileArchive } from "lucide-react";

interface GSCUploadModalProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── Robust CSV parser (handles quoted fields with commas & newlines) ──
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = "";
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        current.push(field.trim());
        if (current.length > 1 || (current.length === 1 && current[0] !== "")) {
          rows.push(current);
        }
        current = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length) {
    current.push(field.trim());
    if (current.length > 1 || (current.length === 1 && current[0] !== "")) {
      rows.push(current);
    }
  }
  return rows;
}

function parsePct(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace("%", "").trim()) || 0;
}

export function GSCUploadModal({ clientId, isOpen, onClose, onSuccess }: GSCUploadModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [parsedData, setParsedData] = useState<{
    dateRangeStart: string;
    dateRangeEnd: string;
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
    dailyBreakdown: any[];
    topQueries: any[];
    topPages: any[];
    countryBreakdown: any[];
    deviceBreakdown: any[];
    searchAppearance: any[];
    filesDetected: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setStatusMessage("Reading CSV files...");
    try {
      const rawFiles: { name: string; content: string }[] = [];

      // Check if it's a zip file
      if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
        const zipFile = files[0];
        const zip = await JSZip.loadAsync(zipFile);

        for (const [filename, fileObj] of Object.entries(zip.files)) {
          if (!fileObj.dir && filename.toLowerCase().endsWith(".csv")) {
            const content = await fileObj.async("text");
            const baseName = filename.split("/").pop()?.split("\\").pop() || filename;
            rawFiles.push({ name: baseName.toLowerCase(), content });
          }
        }
      } else {
        // One or more CSV/ZIP files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const lowerName = file.name.toLowerCase();
          if (lowerName.endsWith(".zip")) {
            const zip = await JSZip.loadAsync(file);
            for (const [filename, fileObj] of Object.entries(zip.files)) {
              if (!fileObj.dir && filename.toLowerCase().endsWith(".csv")) {
                const content = await fileObj.async("text");
                const baseName = filename.split("/").pop()?.split("\\").pop() || filename;
                rawFiles.push({ name: baseName.toLowerCase(), content });
              }
            }
          } else if (lowerName.endsWith(".csv")) {
            const content = await file.text();
            rawFiles.push({ name: lowerName, content });
          }
        }
      }

      if (rawFiles.length === 0) {
        toast.error("No valid CSV files found. Please upload a GSC ZIP export or CSV files.");
        setIsProcessing(false);
        setStatusMessage("");
        return;
      }

      // Parse CSV files using BOTH header inspection and filename matching
      let dailyBreakdown: any[] = [];
      let topQueries: any[] = [];
      let topPages: any[] = [];
      let countryBreakdown: any[] = [];
      let deviceBreakdown: any[] = [];
      let searchAppearance: any[] = [];
      const filesDetectedSet = new Set<string>();

      for (const file of rawFiles) {
        const rows = parseCSV(file.content);
        if (rows.length < 2) continue;

        const headers = rows[0].map((h) => h.toLowerCase().replace(/^\uFEFF/, "").trim());
        const firstCol = headers[0] || "";
        const fname = file.name;

        const isChart =
          firstCol === "date" ||
          firstCol === "dates" ||
          fname === "chart.csv" ||
          fname === "dates.csv" ||
          fname.includes("chart") ||
          fname.includes("dates");

        const isQueries =
          firstCol.includes("quer") ||
          fname === "queries.csv" ||
          fname.includes("quer");

        const isPages =
          firstCol.includes("page") ||
          firstCol === "url" ||
          fname === "pages.csv" ||
          fname.includes("page");

        const isCountries =
          firstCol.includes("countr") ||
          fname === "countries.csv" ||
          fname.includes("countr");

        const isDevices =
          firstCol.includes("device") ||
          fname === "devices.csv" ||
          fname.includes("device");

        const isSearchApp =
          firstCol.includes("appearance") ||
          fname.includes("appearance");

        if (isChart) {
          filesDetectedSet.add("Chart/Dates");
          dailyBreakdown = rows.slice(1).map((r) => ({
            date: r[0],
            clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
            impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
            ctr: parsePct(r[3]),
            position: parseFloat(r[4]) || 0,
          })).filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date));
        } else if (isQueries) {
          filesDetectedSet.add("Queries");
          topQueries = rows.slice(1).map((r) => ({
            query: r[0],
            clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
            impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
            ctr: parsePct(r[3]),
            position: parseFloat(r[4]) || 0,
          })).filter((q) => q.query);
        } else if (isPages) {
          filesDetectedSet.add("Pages");
          topPages = rows.slice(1).map((r) => ({
            page: r[0],
            clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
            impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
            ctr: parsePct(r[3]),
            position: parseFloat(r[4]) || 0,
          })).filter((p) => p.page);
        } else if (isCountries) {
          filesDetectedSet.add("Countries");
          countryBreakdown = rows.slice(1).map((r) => ({
            country: r[0],
            clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
            impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
            ctr: parsePct(r[3]),
            position: parseFloat(r[4]) || 0,
          })).filter((c) => c.country);
        } else if (isDevices) {
          filesDetectedSet.add("Devices");
          deviceBreakdown = rows.slice(1).map((r) => ({
            device: r[0],
            clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
            impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
            ctr: parsePct(r[3]),
            position: parseFloat(r[4]) || 0,
          })).filter((d) => d.device);
        } else if (isSearchApp) {
          filesDetectedSet.add("Search Appearance");
          searchAppearance = rows.slice(1).map((r) => ({
            type: r[0],
            clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
            impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
            ctr: parsePct(r[3]),
            position: parseFloat(r[4]) || 0,
          })).filter((s) => s.type);
        } else {
          // Fallback: inspect first data row value to infer table type
          const sampleVal = (rows[1]?.[0] || "").trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(sampleVal)) {
            filesDetectedSet.add("Chart/Dates");
            dailyBreakdown = rows.slice(1).map((r) => ({
              date: r[0],
              clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
              impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
              ctr: parsePct(r[3]),
              position: parseFloat(r[4]) || 0,
            })).filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date));
          } else if (sampleVal.startsWith("http://") || sampleVal.startsWith("https://")) {
            filesDetectedSet.add("Pages");
            topPages = rows.slice(1).map((r) => ({
              page: r[0],
              clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
              impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
              ctr: parsePct(r[3]),
              position: parseFloat(r[4]) || 0,
            })).filter((p) => p.page);
          } else {
            filesDetectedSet.add("Queries");
            topQueries = rows.slice(1).map((r) => ({
              query: r[0],
              clicks: parseInt((r[1] || "").replace(/,/g, "")) || 0,
              impressions: parseInt((r[2] || "").replace(/,/g, "")) || 0,
              ctr: parsePct(r[3]),
              position: parseFloat(r[4]) || 0,
            })).filter((q) => q.query);
          }
        }
      }

      const filesDetected = Array.from(filesDetectedSet);
      if (filesDetected.length === 0) {
        toast.error("Could not recognize GSC table columns in the uploaded CSV.");
        setIsProcessing(false);
        setStatusMessage("");
        return;
      }

      // Compute KPIs from the most authoritative table included in the upload:
      // 1. Chart/Dates (exact daily property totals)
      // 2. Devices (exact property totals across Desktop + Mobile + Tablet)
      // 3. Countries
      // 4. Queries
      // 5. Pages
      // 6. Search Appearance
      const primaryTable =
        dailyBreakdown.length > 0 ? dailyBreakdown :
        deviceBreakdown.length > 0 ? deviceBreakdown :
        countryBreakdown.length > 0 ? countryBreakdown :
        topQueries.length > 0 ? topQueries :
        topPages.length > 0 ? topPages :
        searchAppearance;

      const totalClicks = primaryTable.reduce((s, item) => s + (item.clicks || 0), 0);
      const totalImpressions = primaryTable.reduce((s, item) => s + (item.impressions || 0), 0);
      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const weightedPosNumerator = primaryTable.reduce(
        (s, item) => s + (item.position || 0) * (item.impressions || 1),
        0
      );
      const weightedPosDenominator = primaryTable.reduce(
        (s, item) => s + (item.impressions || 1),
        0
      );
      const avgPosition = dailyBreakdown.length > 0
        ? dailyBreakdown.reduce((s, d) => s + (d.position || 0), 0) / dailyBreakdown.length
        : (weightedPosDenominator > 0 ? weightedPosNumerator / weightedPosDenominator : 0);

      // Determine date range
      const dates = dailyBreakdown.map((d) => d.date).sort();
      let dateRangeStart = dates[0] || "";
      let dateRangeEnd = dates[dates.length - 1] || "";

      if (!dateRangeStart || !dateRangeEnd) {
        // Check if any filename encodes YYYY-MM-DD dates
        const allNames = Array.from(files).map((f) => f.name).join(" ");
        const matchedDates = allNames.match(/\d{4}-\d{2}-\d{2}/g);
        if (matchedDates && matchedDates.length >= 2) {
          const sortedMatched = [...matchedDates].sort();
          dateRangeStart = sortedMatched[0];
          dateRangeEnd = sortedMatched[sortedMatched.length - 1];
        } else {
          // Check latest existing row in report_gsc_metrics for this client
          const { data: latestExisting } = await supabase
            .from("report_gsc_metrics" as any)
            .select("date_range_start, date_range_end, collected_at")
            .eq("client_id", clientId)
            .order("collected_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestExisting && (latestExisting as any).date_range_start && (latestExisting as any).date_range_end) {
            dateRangeStart = (latestExisting as any).date_range_start;
            dateRangeEnd = (latestExisting as any).date_range_end;
          } else {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 6);
            dateRangeStart = start.toISOString().slice(0, 10);
            dateRangeEnd = end.toISOString().slice(0, 10);
          }
        }
      }

      setParsedData({
        dateRangeStart,
        dateRangeEnd,
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
        dailyBreakdown,
        topQueries,
        topPages,
        countryBreakdown,
        deviceBreakdown,
        searchAppearance,
        filesDetected,
      });

      toast.success(`Successfully parsed ${filesDetected.length} GSC data table${filesDetected.length > 1 ? "s" : ""}.`);
    } catch (err: any) {
      console.error("GSC parse error:", err);
      toast.error(`Error processing files: ${err.message || "Invalid format"}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async () => {
    if (!parsedData || !clientId) return;

    setIsProcessing(true);
    setStatusMessage("Saving GSC metrics to database...");
    try {
      // Fetch existing row for this date range AND latest row overall so partial CSV uploads
      // (e.g. uploading only Queries.csv or Pages.csv or Chart.csv) merge cleanly instead of wiping other tables
      const [{ data: samePeriodRow }, { data: latestExistingRow }] = await Promise.all([
        supabase
          .from("report_gsc_metrics" as any)
          .select("*")
          .eq("client_id", clientId)
          .eq("date_range_start", parsedData.dateRangeStart)
          .eq("date_range_end", parsedData.dateRangeEnd)
          .maybeSingle(),
        supabase
          .from("report_gsc_metrics" as any)
          .select("*")
          .eq("client_id", clientId)
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const baseRow: any = samePeriodRow || latestExistingRow || null;
      const isPartialUpload = parsedData.filesDetected.length < 5;

      const mergedTopQueries =
        parsedData.topQueries.length > 0
          ? parsedData.topQueries
          : (isPartialUpload && Array.isArray(baseRow?.top_queries) ? baseRow.top_queries : []);

      const mergedTopPages =
        parsedData.topPages.length > 0
          ? parsedData.topPages
          : (isPartialUpload && Array.isArray(baseRow?.top_pages) ? baseRow.top_pages : []);

      const mergedDevices =
        parsedData.deviceBreakdown.length > 0
          ? parsedData.deviceBreakdown
          : (isPartialUpload && Array.isArray(baseRow?.device_breakdown) ? baseRow.device_breakdown : []);

      const mergedCountries =
        parsedData.countryBreakdown.length > 0
          ? parsedData.countryBreakdown
          : (isPartialUpload && Array.isArray(baseRow?.country_breakdown) ? baseRow.country_breakdown : []);

      const mergedSearchAppearance =
        parsedData.searchAppearance.length > 0
          ? parsedData.searchAppearance
          : (isPartialUpload && Array.isArray(baseRow?.search_appearance) ? baseRow.search_appearance : []);

      let mergedDailyBreakdown =
        parsedData.dailyBreakdown.length > 0
          ? parsedData.dailyBreakdown
          : (samePeriodRow && Array.isArray((samePeriodRow as any).daily_breakdown) && (samePeriodRow as any).daily_breakdown.length > 0
              ? (samePeriodRow as any).daily_breakdown
              : []);

      // Determine final KPI totals:
      // If this upload included Chart/Dates or is a new period, use parsedData's KPIs;
      // If merging a secondary table (like Pages.csv) into an existing period that already has Chart.csv, preserve Chart.csv totals unless parsedData has higher/authoritative totals.
      let finalClicks = parsedData.totalClicks;
      let finalImpressions = parsedData.totalImpressions;
      let finalCtr = parsedData.avgCtr;
      let finalPosition = parsedData.avgPosition;

      if (
        parsedData.dailyBreakdown.length === 0 &&
        samePeriodRow &&
        Array.isArray((samePeriodRow as any).daily_breakdown) &&
        (samePeriodRow as any).daily_breakdown.length > 0 &&
        !parsedData.filesDetected.includes("Devices")
      ) {
        // Keep the authoritative Chart.csv totals from samePeriodRow if the user is just adding Pages/Queries to the same period
        finalClicks = (samePeriodRow as any).total_clicks || parsedData.totalClicks;
        finalImpressions = (samePeriodRow as any).total_impressions || parsedData.totalImpressions;
        finalCtr = parseFloat((samePeriodRow as any).avg_ctr) || parsedData.avgCtr;
        finalPosition = parseFloat((samePeriodRow as any).avg_position) || parsedData.avgPosition;
      }

      // If daily_breakdown is still empty (e.g., user uploaded Queries.csv for a new date range without Chart.csv),
      // synthesize daily breakdown points across dateRangeStart..dateRangeEnd so charts and date filters update immediately
      if (mergedDailyBreakdown.length === 0 && parsedData.dateRangeStart && parsedData.dateRangeEnd) {
        const startDt = new Date(parsedData.dateRangeStart + "T00:00:00Z");
        const endDt = new Date(parsedData.dateRangeEnd + "T00:00:00Z");
        const daysList: string[] = [];
        for (let d = new Date(startDt); d <= endDt && daysList.length < 95; d.setUTCDate(d.getUTCDate() + 1)) {
          daysList.push(d.toISOString().slice(0, 10));
        }
        if (daysList.length === 0) daysList.push(parsedData.dateRangeStart);
        const n = daysList.length;
        const baseClicks = Math.floor(finalClicks / n);
        const remClicks = finalClicks - baseClicks * n;
        const baseImp = Math.floor(finalImpressions / n);
        const remImp = finalImpressions - baseImp * n;

        mergedDailyBreakdown = daysList.map((dateStr, idx) => {
          const c = baseClicks + (idx < remClicks ? 1 : 0);
          const imp = baseImp + (idx < remImp ? 1 : 0);
          return {
            date: dateStr,
            clicks: c,
            impressions: imp,
            ctr: imp > 0 ? parseFloat(((c / imp) * 100).toFixed(2)) : parseFloat(finalCtr.toFixed(2)),
            position: parseFloat(finalPosition.toFixed(2)),
          };
        });
      }

      const row = {
        client_id: clientId,
        date_range_start: parsedData.dateRangeStart,
        date_range_end: parsedData.dateRangeEnd,
        total_clicks: finalClicks,
        total_impressions: finalImpressions,
        avg_ctr: parseFloat(finalCtr.toFixed(4)),
        avg_position: parseFloat(finalPosition.toFixed(2)),
        top_queries: mergedTopQueries,
        top_pages: mergedTopPages,
        device_breakdown: mergedDevices,
        country_breakdown: mergedCountries,
        daily_breakdown: mergedDailyBreakdown,
        search_appearance: mergedSearchAppearance,
        source: "csv_import",
        collected_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("report_gsc_metrics" as any)
        .upsert(row, { onConflict: "client_id,date_range_start,date_range_end" });

      if (error) throw error;

      // Immediately invalidate & refetch all GSC-dependent queries so UI cards, tables, and charts update right away
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-gsc-metrics", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-connected-accounts", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["hairtamin-gsc-performance-story", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["summary-metrics", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["client-summary-metrics", clientId] }),
      ]);

      // Sync & regenerate SEO & Website Overview AI summaries via server endpoint (with service-role patching)
      setStatusMessage("Updating SEO & Website AI Overviews...");
      try {
        const syncResp = await fetch("/api/gsc/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, row }),
        });
        if (!syncResp.ok) {
          throw new Error(`Sync route returned ${syncResp.status}`);
        }
      } catch {
        // Fallback to direct Edge Function invocation if server route is unavailable
        await Promise.allSettled([
          supabase.functions.invoke("generate-analytics-summary", {
            body: { clientId, type: "seo", dateRange: "7d" },
          }),
          supabase.functions.invoke("generate-analytics-summary", {
            body: { clientId, type: "website", dateRange: "7d" },
          }),
        ]);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-gsc-metrics", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["hairtamin-gsc-performance-story", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["analytics-summary", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["summary-metrics", clientId] }),
        queryClient.invalidateQueries({ queryKey: ["sync_state", clientId] }),
      ]);

      toast.success("Google Search Console data & AI Overviews updated!");
      setParsedData(null);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("GSC save error:", err);
      toast.error(`Failed to save GSC data: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setStatusMessage("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setParsedData(null); onClose(); } }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <span className="text-2xl">🔍</span> Upload Google Search Console Data
          </DialogTitle>
          <DialogDescription>
            Export your data from Google Search Console (via <strong>Export → Download ZIP</strong> or CSVs) and upload it here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Dropzone / Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06] rounded-2xl p-6 text-center cursor-pointer transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
                <FileArchive className="h-6 w-6" />
              </div>
              <p className="font-semibold text-sm text-foreground">
                Click to select GSC ZIP export or CSV files
              </p>
              <p className="text-xs text-muted-foreground">
                Supports <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.zip</code> export or multiple <code className="bg-muted px-1 py-0.5 rounded text-[11px]">.csv</code> files (Chart, Queries, Pages, Countries, Devices)
              </p>
            </div>
          </div>

          {/* Processing Spinner */}
          {isProcessing && !parsedData && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Processing files...
            </div>
          )}

          {/* Parsed Summary Preview */}
          {parsedData && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold text-sm">Ready to Import</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    type="date"
                    value={parsedData.dateRangeStart}
                    onChange={(e) =>
                      setParsedData((prev) =>
                        prev ? { ...prev, dateRangeStart: e.target.value } : prev
                      )
                    }
                    className="bg-background border border-border rounded px-2 py-1 text-xs font-medium"
                  />
                  <span className="text-muted-foreground">→</span>
                  <input
                    type="date"
                    value={parsedData.dateRangeEnd}
                    onChange={(e) =>
                      setParsedData((prev) =>
                        prev ? { ...prev, dateRangeEnd: e.target.value } : prev
                      )
                    }
                    className="bg-background border border-border rounded px-2 py-1 text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
                <div className="bg-background/80 p-2.5 rounded-lg border text-center">
                  <p className="text-[11px] text-muted-foreground">Clicks</p>
                  <p className="font-bold text-base text-emerald-600">{parsedData.totalClicks.toLocaleString()}</p>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border text-center">
                  <p className="text-[11px] text-muted-foreground">Impressions</p>
                  <p className="font-bold text-base text-blue-600">{parsedData.totalImpressions.toLocaleString()}</p>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border text-center">
                  <p className="text-[11px] text-muted-foreground">Queries</p>
                  <p className="font-bold text-base">{parsedData.topQueries.length}</p>
                </div>
                <div className="bg-background/80 p-2.5 rounded-lg border text-center">
                  <p className="text-[11px] text-muted-foreground">Pages</p>
                  <p className="font-bold text-base">{parsedData.topPages.length}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsedData.filesDetected.map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-medium">
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={isProcessing} onClick={() => { setParsedData(null); onClose(); }}>
            Cancel
          </Button>
          <Button
            disabled={!parsedData || isProcessing}
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isProcessing ? (statusMessage || "Saving...") : "Save to Dashboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
