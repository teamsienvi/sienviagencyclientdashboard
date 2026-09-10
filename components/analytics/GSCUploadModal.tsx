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
    try {
      const fileMap = new Map<string, string>();

      // Check if it's a zip file
      if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
        const zipFile = files[0];
        const zip = await JSZip.loadAsync(zipFile);

        for (const [filename, fileObj] of Object.entries(zip.files)) {
          if (!fileObj.dir && filename.toLowerCase().endsWith(".csv")) {
            const content = await fileObj.async("text");
            // Normalize filename without directory path
            const baseName = filename.split("/").pop()?.split("\\").pop() || filename;
            fileMap.set(baseName.toLowerCase(), content);
          }
        }
      } else {
        // Multiple CSV files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.name.toLowerCase().endsWith(".csv")) {
            const content = await file.text();
            fileMap.set(file.name.toLowerCase(), content);
          }
        }
      }

      if (fileMap.size === 0) {
        toast.error("No valid CSV files found. Please upload a GSC ZIP export or CSV files.");
        setIsProcessing(false);
        return;
      }

      // Parse CSV files
      let dailyBreakdown: any[] = [];
      let topQueries: any[] = [];
      let topPages: any[] = [];
      let countryBreakdown: any[] = [];
      let deviceBreakdown: any[] = [];
      let searchAppearance: any[] = [];
      const filesDetected: string[] = [];

      // 1. Chart.csv or Dates.csv
      const chartRaw = fileMap.get("chart.csv") || fileMap.get("dates.csv");
      if (chartRaw) {
        filesDetected.push("Chart/Dates");
        const rows = parseCSV(chartRaw);
        dailyBreakdown = rows.slice(1).map((r) => ({
          date: r[0],
          clicks: parseInt(r[1]) || 0,
          impressions: parseInt(r[2]) || 0,
          ctr: parsePct(r[3]),
          position: parseFloat(r[4]) || 0,
        })).filter(d => d.date && d.date.length >= 8);
      }

      // 2. Queries.csv
      const queriesRaw = fileMap.get("queries.csv");
      if (queriesRaw) {
        filesDetected.push("Queries");
        const rows = parseCSV(queriesRaw);
        topQueries = rows.slice(1).map((r) => ({
          query: r[0],
          clicks: parseInt(r[1]) || 0,
          impressions: parseInt(r[2]) || 0,
          ctr: parsePct(r[3]),
          position: parseFloat(r[4]) || 0,
        })).filter(q => q.query);
      }

      // 3. Pages.csv
      const pagesRaw = fileMap.get("pages.csv");
      if (pagesRaw) {
        filesDetected.push("Pages");
        const rows = parseCSV(pagesRaw);
        topPages = rows.slice(1).map((r) => ({
          page: r[0],
          clicks: parseInt(r[1]) || 0,
          impressions: parseInt(r[2]) || 0,
          ctr: parsePct(r[3]),
          position: parseFloat(r[4]) || 0,
        })).filter(p => p.page);
      }

      // 4. Countries.csv
      const countriesRaw = fileMap.get("countries.csv");
      if (countriesRaw) {
        filesDetected.push("Countries");
        const rows = parseCSV(countriesRaw);
        countryBreakdown = rows.slice(1).map((r) => ({
          country: r[0],
          clicks: parseInt(r[1]) || 0,
          impressions: parseInt(r[2]) || 0,
          ctr: parsePct(r[3]),
          position: parseFloat(r[4]) || 0,
        })).filter(c => c.country);
      }

      // 5. Devices.csv
      const devicesRaw = fileMap.get("devices.csv");
      if (devicesRaw) {
        filesDetected.push("Devices");
        const rows = parseCSV(devicesRaw);
        deviceBreakdown = rows.slice(1).map((r) => ({
          device: r[0],
          clicks: parseInt(r[1]) || 0,
          impressions: parseInt(r[2]) || 0,
          ctr: parsePct(r[3]),
          position: parseFloat(r[4]) || 0,
        })).filter(d => d.device);
      }

      // 6. Search appearance.csv
      const searchAppRaw = fileMap.get("search appearance.csv") || fileMap.get("search_appearance.csv");
      if (searchAppRaw) {
        filesDetected.push("Search Appearance");
        const rows = parseCSV(searchAppRaw);
        searchAppearance = rows.slice(1).map((r) => ({
          type: r[0],
          clicks: parseInt(r[1]) || 0,
          impressions: parseInt(r[2]) || 0,
          ctr: parsePct(r[3]),
          position: parseFloat(r[4]) || 0,
        })).filter(s => s.type);
      }

      // Calculate totals
      const totalClicks = dailyBreakdown.length > 0
        ? dailyBreakdown.reduce((s, d) => s + d.clicks, 0)
        : topQueries.reduce((s, q) => s + q.clicks, 0);

      const totalImpressions = dailyBreakdown.length > 0
        ? dailyBreakdown.reduce((s, d) => s + d.impressions, 0)
        : topQueries.reduce((s, q) => s + q.impressions, 0);

      const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgPosition = dailyBreakdown.length > 0
        ? dailyBreakdown.reduce((s, d) => s + d.position, 0) / dailyBreakdown.length
        : 0;

      const dates = dailyBreakdown.map((d) => d.date).sort();
      const dateRangeStart = dates.length > 0 ? dates[0] : new Date().toISOString().slice(0, 10);
      const dateRangeEnd = dates.length > 0 ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);

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

      toast.success(`Successfully parsed ${filesDetected.length} GSC data tables.`);
    } catch (err: any) {
      console.error("GSC parse error:", err);
      toast.error(`Error processing files: ${err.message || "Invalid format"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData || !clientId) return;

    setIsProcessing(true);
    try {
      const row = {
        client_id: clientId,
        date_range_start: parsedData.dateRangeStart,
        date_range_end: parsedData.dateRangeEnd,
        total_clicks: parsedData.totalClicks,
        total_impressions: parsedData.totalImpressions,
        avg_ctr: parseFloat(parsedData.avgCtr.toFixed(4)),
        avg_position: parseFloat(parsedData.avgPosition.toFixed(2)),
        top_queries: parsedData.topQueries,
        top_pages: parsedData.topPages,
        device_breakdown: parsedData.deviceBreakdown,
        country_breakdown: parsedData.countryBreakdown,
        daily_breakdown: parsedData.dailyBreakdown,
        search_appearance: parsedData.searchAppearance,
        source: "csv_import",
        collected_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("report_gsc_metrics" as any)
        .upsert(row, { onConflict: "client_id,date_range_start,date_range_end" });

      if (error) throw error;

      toast.success("Google Search Console data imported successfully!");
      queryClient.invalidateQueries({ queryKey: ["client-gsc-metrics", clientId] });
      queryClient.invalidateQueries({ queryKey: ["client-connected-accounts", clientId] });
      
      setParsedData(null);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("GSC save error:", err);
      toast.error(`Failed to save GSC data: ${err.message}`);
    } finally {
      setIsProcessing(false);
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold text-sm">Ready to Import</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {parsedData.dateRangeStart} → {parsedData.dateRangeEnd}
                </span>
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
          <Button variant="outline" onClick={() => { setParsedData(null); onClose(); }}>
            Cancel
          </Button>
          <Button
            disabled={!parsedData || isProcessing}
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Save to Dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
