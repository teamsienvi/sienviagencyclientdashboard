import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Check, AlertCircle, Twitter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface XCSVRow {
  link?: string;
  url?: string;
  title?: string;
  date?: string;
  impressions?: number;
  likes?: number;
  comments?: number;
  replies?: number;
  shares?: number;
  reposts?: number;
  engagements?: number;
  views?: number;
}

interface XCSVUploadDialogProps {
  clientId: string;
  clientName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  onUploadComplete?: () => void;
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseValue = (value: string): string | number => {
  const cleanValue = value.replace('%', '').replace(/,/g, '');
  const numValue = parseFloat(cleanValue);
  return isNaN(numValue) ? value : numValue;
};

export const XCSVUploadDialog = ({
  clientId,
  clientName,
  trigger,
  onSuccess,
  onUploadComplete,
}: XCSVUploadDialogProps) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(file.type === "text/csv" || file.name.endsWith(".csv"))) {
      toast.error("Please upload a CSV file");
      return;
    }

    setCsvFile(file);

    // Auto-fill period from the CSV (when possible)
    try {
      const csvText = await readFileAsText(file);
      const parsedRows = parseXCSV(csvText);
      const inferred = inferPeriodFromRows(parsedRows);

      if (inferred?.start && inferred?.end) {
        setPeriodStart(inferred.start);
        setPeriodEnd(inferred.end);
      }
    } catch {
      // If inference fails, keep manual inputs
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const toDateStr = (d: Date) => d.toISOString().split("T")[0];

  const safeParseDate = (value?: string): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  };

  const inferPeriodFromRows = (rows: XCSVRow[]) => {
    const dates = rows
      .map((r) => safeParseDate(r.date))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) return null;
    return { start: toDateStr(dates[0]), end: toDateStr(dates[dates.length - 1]) };
  };

  const extractXDashboardMetrics = (csvText: string): {
    followers?: number;
    oldFollowers?: number;
    addedFollowers?: number;
    engagementRate?: number;
    engagementRateLastWeek?: number;
    totalContent?: number;
    totalContentLastWeek?: number;
    periodLabel?: string;
  } => {
    const lines = csvText.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    const findNumberAfterLabel = (line: string, label: string): number | undefined => {
      const cells = parseCSVLine(line);
      const lowerLabel = label.toLowerCase();
      
      for (let i = 0; i < cells.length; i++) {
        const cellLower = (cells[i] || "").toLowerCase().trim();
        if (cellLower.includes(lowerLabel)) {
          // Check the next cell for the value
          for (let j = i + 1; j < cells.length; j++) {
            const v = parseValue((cells[j] || "").trim());
            if (typeof v === "number" && !Number.isNaN(v)) return v;
          }
        }
      }
      return undefined;
    };

    const findFirstNumberInLine = (line: string): number | undefined => {
      const cells = parseCSVLine(line);
      for (const cell of cells) {
        const v = parseValue((cell || "").trim());
        if (typeof v === "number" && !Number.isNaN(v)) return v;
      }
      return undefined;
    };

    const metrics: {
      followers?: number;
      oldFollowers?: number;
      addedFollowers?: number;
      engagementRate?: number;
      engagementRateLastWeek?: number;
      totalContent?: number;
      totalContentLastWeek?: number;
      periodLabel?: string;
    } = {};

    for (const line of lines) {
      const lower = line.toLowerCase();

      // Extract period from header like "Weekly Performance Insights (Dec Dec 29 - Jan 4)"
      if (lower.includes("weekly performance insights") || lower.includes("performance insights")) {
        const periodMatch = line.match(/\(([^)]+)\)/);
        if (periodMatch) {
          metrics.periodLabel = periodMatch[1].trim();
        }
      }

      // Old Followers (row 37 format: "Old Followers:,,10")
      if (lower.includes("old followers")) {
        metrics.oldFollowers = findFirstNumberInLine(line);
      }

      // Added Followers (row 38 format: "Added Followers:,,-" or "Added Followers:,,5")
      if (lower.includes("added followers")) {
        const val = findFirstNumberInLine(line);
        // If it's a dash or empty, treat as 0
        metrics.addedFollowers = val !== undefined ? val : 0;
      }

      // Total Followers (row 39 format: "Total Followers:,,10")
      if (lower.includes("total followers")) {
        metrics.followers = findFirstNumberInLine(line);
      }

      // Engagement Rate (row 40 has both current and last week)
      if (lower.includes("engagement rate")) {
        // Check for last week first
        if (lower.includes("last week")) {
          metrics.engagementRateLastWeek = findNumberAfterLabel(line, "last week");
        }
        // Current engagement rate (first number in the line, not associated with "last week")
        if (metrics.engagementRate === undefined && !lower.includes("last week")) {
          metrics.engagementRate = findFirstNumberInLine(line);
        }
      }

      // Handle the combined line format: "Engagement Rate:,,3.26,Engagement Rate Last week:,,9.62"
      if (lower.includes("engagement rate") && lower.includes("last week")) {
        const cells = parseCSVLine(line);
        let foundCurrent = false;
        for (let i = 0; i < cells.length; i++) {
          const cellLower = (cells[i] || "").toLowerCase().trim();
          if (cellLower.includes("engagement rate") && !cellLower.includes("last week")) {
            // Get the next numeric value for current
            for (let j = i + 1; j < cells.length; j++) {
              const v = parseValue((cells[j] || "").trim());
              if (typeof v === "number" && !Number.isNaN(v)) {
                if (!foundCurrent) {
                  metrics.engagementRate = v;
                  foundCurrent = true;
                }
                break;
              }
            }
          }
          if (cellLower.includes("last week")) {
            // Get the next numeric value for last week
            for (let j = i + 1; j < cells.length; j++) {
              const v = parseValue((cells[j] || "").trim());
              if (typeof v === "number" && !Number.isNaN(v)) {
                metrics.engagementRateLastWeek = v;
                break;
              }
            }
          }
        }
      }

      // Total number of content this week
      if (lower.includes("total number of content this week")) {
        metrics.totalContent = findNumberAfterLabel(line, "this week");
        if (metrics.totalContent === undefined) {
          // Fallback: find number after "total number of content this week"
          const cells = parseCSVLine(line);
          for (let i = 0; i < cells.length; i++) {
            if ((cells[i] || "").toLowerCase().includes("this week")) {
              for (let j = i + 1; j < cells.length; j++) {
                const v = parseValue((cells[j] || "").trim());
                if (typeof v === "number" && !Number.isNaN(v)) {
                  metrics.totalContent = v;
                  break;
                }
              }
            }
          }
        }
      }

      // Total number of content last week
      if (lower.includes("total number of content last week")) {
        metrics.totalContentLastWeek = findNumberAfterLabel(line, "last week");
        if (metrics.totalContentLastWeek === undefined) {
          const cells = parseCSVLine(line);
          for (let i = 0; i < cells.length; i++) {
            if ((cells[i] || "").toLowerCase().includes("last week")) {
              for (let j = i + 1; j < cells.length; j++) {
                const v = parseValue((cells[j] || "").trim());
                if (typeof v === "number" && !Number.isNaN(v)) {
                  metrics.totalContentLastWeek = v;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Calculate old followers from total - added if not found directly
    if (metrics.oldFollowers === undefined && metrics.followers !== undefined && metrics.addedFollowers !== undefined) {
      metrics.oldFollowers = metrics.followers - metrics.addedFollowers;
    }

    console.log("Extracted dashboard metrics:", metrics);
    return metrics;
  };

  const parseXCSV = (csvText: string): XCSVRow[] => {
    // Handle different line endings (Windows, Mac, Unix)
    const lines = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return [];

    // More flexible header matching - check if header contains the key
    const findMappedKey = (header: string): keyof XCSVRow | null => {
      const h = header.toLowerCase();
      if (h.includes('link') || h.includes('url') || h.includes('permalink')) return 'link';
      if (h.includes('title') || h.includes('post') || h.includes('content') || h.includes('text') || h.includes('tweet')) return 'title';
      if (h.includes('date') || h.includes('time') || h.includes('posted') || h.includes('published')) return 'date';
      if (h.includes('impression')) return 'impressions';
      if (h.includes('view')) return 'views';
      if (h.includes('like') || h.includes('favorite')) return 'likes';
      if (h.includes('comment') || h.includes('repl')) return 'comments';
      if (h.includes('share') || h.includes('repost') || h.includes('retweet')) return 'shares';
      if (h.includes('engagement')) return 'engagements';
      return null;
    };

    // Find the X data section by looking for the header row with DATE PUBLISHED
    let headerLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (lineLower.includes('date') && (lineLower.includes('impression') || lineLower.includes('engagement'))) {
        headerLineIndex = i;
        break;
      }
    }

    // If no header found, try first non-empty line as header (fallback for simple CSVs)
    if (headerLineIndex === -1) {
      headerLineIndex = 0;
    }

    const headers = parseCSVLine(lines[headerLineIndex]).map(h => 
      h.toLowerCase().replace(/['"]/g, '').trim()
    );
    
    console.log("Found header at line:", headerLineIndex, "Headers:", headers);
    const rows: XCSVRow[] = [];

    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Stop at "Total:" line or empty data
      if (line.toLowerCase().startsWith('total')) break;
      
      const values = parseCSVLine(line);
      if (values.length < 2) continue;
      
      // Skip rows where first column is empty or just whitespace
      if (!values[0] || values[0].trim() === '') continue;

      const row: XCSVRow = {};
      headers.forEach((header, index) => {
        const mappedKey = findMappedKey(header);
        if (mappedKey && values[index] !== undefined && values[index] !== '') {
          const value = parseValue(values[index]);
          (row as any)[mappedKey] = value;
        }
      });
      
      console.log("Parsed row:", row);
      
      // Only add rows that have at least a date or any numeric data
      if (row.date || row.impressions || row.views || row.likes || row.engagements) {
        rows.push(row);
      }
    }

    console.log("Total parsed rows:", rows.length);
    return rows;
  };

  const handleUpload = async () => {
    if (!csvFile) {
      toast.error("Please upload a CSV file");
      return;
    }

    setIsUploading(true);

    try {
      const csvText = await readFileAsText(csvFile);
      const parsedData = parseXCSV(csvText);

      if (parsedData.length === 0) {
        toast.error("Could not parse any data from the CSV. Please check the format.");
        setIsUploading(false);
        return;
      }

      const inferredPeriod = inferPeriodFromRows(parsedData);
      const effectivePeriodStart = periodStart || inferredPeriod?.start;
      const effectivePeriodEnd = periodEnd || inferredPeriod?.end;

      if (!effectivePeriodStart || !effectivePeriodEnd) {
        toast.error("Please select a date range (or upload a CSV that includes post dates).");
        return;
      }

      // DELETE ALL existing content and metrics for this client + platform to REPLACE data (not append)
      console.log("Deleting ALL existing X content for client:", clientId);
      
      // First, get all existing social_content IDs for this client/platform
      const { data: existingContent } = await supabase
        .from("social_content")
        .select("id")
        .eq("client_id", clientId)
        .eq("platform", "x");

      if (existingContent && existingContent.length > 0) {
        const contentIds = existingContent.map(c => c.id);
        
        // Delete ALL metrics for these content items (not filtered by period)
        const { error: metricsDeleteError } = await supabase
          .from("social_content_metrics")
          .delete()
          .in("social_content_id", contentIds);
        
        if (metricsDeleteError) {
          console.error("Error deleting content metrics:", metricsDeleteError);
        } else {
          console.log("Deleted all existing content metrics for", contentIds.length, "items");
        }
        
        // Delete ALL content items for this client/platform
        const { error: contentDeleteError } = await supabase
          .from("social_content")
          .delete()
          .eq("client_id", clientId)
          .eq("platform", "x");
        
        if (contentDeleteError) {
          console.error("Error deleting content:", contentDeleteError);
        } else {
          console.log("Deleted all existing content for client");
        }
      }

      // Delete ALL existing account metrics for this client/platform and wait for completion
      const { error: accountMetricsDeleteError } = await supabase
        .from("social_account_metrics")
        .delete()
        .eq("client_id", clientId)
        .eq("platform", "x");

      if (accountMetricsDeleteError) {
        console.error("Error deleting account metrics:", accountMetricsDeleteError);
      } else {
        console.log("Deleted all existing account metrics");
      }
      
      // Small delay to ensure deletions are committed before inserts
      await new Promise(resolve => setTimeout(resolve, 100));

      let totalInserted = 0;

      for (const row of parsedData) {
        // Create deterministic content_id from URL or composite key
        const rawUrl = (row.link || row.url || "").trim();
        const rawDate = row.date ? new Date(row.date).toISOString().split("T")[0] : "";
        const contentId = rawUrl || `x_${clientId}_${rawDate}_${row.title?.slice(0, 20) || Math.random().toString(36).substr(2, 9)}`;
        const publishedAt = row.date ? new Date(row.date).toISOString() : new Date().toISOString();

        // Insert new social_content (since we deleted all existing)
        const { data: newContent, error: contentError } = await supabase
          .from("social_content")
          .insert({
            client_id: clientId,
            platform: "x",
            content_id: contentId,
            content_type: "tweet",
            title: row.title || null,
            url: rawUrl || null,
            published_at: publishedAt,
          })
          .select("id")
          .single();

        if (contentError) {
          console.error("Error inserting content:", contentError);
          continue;
        }
        
        const contentDbId = newContent.id;

        // Insert metrics
        const { error: metricsError } = await supabase
          .from("social_content_metrics")
          .insert({
            social_content_id: contentDbId,
            platform: "x",
            period_start: effectivePeriodStart,
            period_end: effectivePeriodEnd,
            impressions: row.impressions || row.views || 0,
            views: row.views || row.impressions || 0,
            likes: row.likes || 0,
            comments: row.comments || row.replies || 0,
            shares: row.shares || row.reposts || 0,
            engagements:
              row.engagements ||
              (row.likes || 0) + (row.comments || row.replies || 0) + (row.shares || row.reposts || 0),
          });

        if (metricsError) {
          console.error("Error inserting metrics:", metricsError);
          continue;
        }

        totalInserted++;
      }

      // Calculate and upsert account-level metrics
      const totalViews = parsedData.reduce((sum, r) => sum + (r.views || r.impressions || 0), 0);
      const totalLikes = parsedData.reduce((sum, r) => sum + (r.likes || 0), 0);
      const totalComments = parsedData.reduce((sum, r) => sum + (r.comments || r.replies || 0), 0);
      const totalShares = parsedData.reduce((sum, r) => sum + (r.shares || r.reposts || 0), 0);
      const totalEngagements = totalLikes + totalComments + totalShares;
      const computedEngagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

      const dashboard = extractXDashboardMetrics(csvText);

      // Use followers from CSV, otherwise fallback to latest known
      let followers: number | null = dashboard.followers ?? null;
      if (followers == null) {
        const { data: latestFollowerRow } = await supabase
          .from("social_account_metrics")
          .select("followers")
          .eq("client_id", clientId)
          .eq("platform", "x")
          .not("followers", "is", null)
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        followers = latestFollowerRow?.followers ?? null;
      }

      const engagementRate = dashboard.engagementRate ?? computedEngagementRate;
      const totalContent = dashboard.totalContent ?? parsedData.length;

      // Calculate added followers from the CSV data
      const addedFollowers = dashboard.addedFollowers ?? (
        dashboard.followers !== undefined && dashboard.oldFollowers !== undefined
          ? dashboard.followers - dashboard.oldFollowers
          : null
      );

      // Insert current period metrics (we deleted all existing above, so just insert)
      await supabase.from("social_account_metrics").insert({
        client_id: clientId,
        platform: "x",
        period_start: effectivePeriodStart,
        period_end: effectivePeriodEnd,
        followers,
        total_content: totalContent,
        engagement_rate: engagementRate,
        new_followers: addedFollowers,
      });

      console.log("Inserted current period metrics:", { effectivePeriodStart, effectivePeriodEnd, followers, engagementRate, totalContent, addedFollowers });

      // Insert previous period metrics if we have the data
      // This allows us to show week-over-week comparisons
      const hasLastWeekData = dashboard.oldFollowers !== undefined || 
                              dashboard.engagementRateLastWeek !== undefined || 
                              dashboard.totalContentLastWeek !== undefined;
      
      if (hasLastWeekData) {
        // Calculate previous period dates (7 days before the current period)
        const currentStart = new Date(effectivePeriodStart);
        const currentEnd = new Date(effectivePeriodEnd);
        const periodDuration = currentEnd.getTime() - currentStart.getTime();
        const prevStart = new Date(currentStart.getTime() - periodDuration - 86400000); // Start of previous week
        const prevEnd = new Date(currentStart.getTime() - 86400000); // Day before current period
        
        const prevPeriodStart = prevStart.toISOString().split("T")[0];
        const prevPeriodEnd = prevEnd.toISOString().split("T")[0];

        const prevFollowers = dashboard.oldFollowers ?? null;
        const prevEngagementRate = dashboard.engagementRateLastWeek ?? null;
        const prevTotalContent = dashboard.totalContentLastWeek ?? null;

        // Insert previous period metrics (we deleted all existing above)
        await supabase.from("social_account_metrics").insert({
          client_id: clientId,
          platform: "x",
          period_start: prevPeriodStart,
          period_end: prevPeriodEnd,
          followers: prevFollowers,
          total_content: prevTotalContent,
          engagement_rate: prevEngagementRate,
        });

        console.log("Inserted previous period metrics:", { prevPeriodStart, prevPeriodEnd, prevFollowers, prevEngagementRate, prevTotalContent });
      }

      toast.success(`Imported ${totalInserted} X posts successfully!`);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["social-content-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["top-performing-posts"] });
      queryClient.invalidateQueries({ queryKey: ["client-social-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["x-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["client-x-content"] });

      setOpen(false);
      resetForm();

      // Call onUploadComplete callback if provided (for auto-refresh)
      onUploadComplete?.();

      // Navigate to X analytics page (pre-set the date range to the imported period)
      router.push(`/x-analytics/${clientId}?start=${effectivePeriodStart}&end=${effectivePeriodEnd}`);

      onSuccess?.();
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast.error("Failed to upload CSV. Please check the format and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setCsvFile(null);
    setPeriodStart("");
    setPeriodEnd("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload X CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            Import X Analytics for {clientName}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with X (Twitter) post data to generate analytics insights.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          {/* CSV Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 h-auto py-4 px-6"
            >
              {csvFile ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{csvFile.name}</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>Upload CSV File</span>
                </>
              )}
            </Button>
          </div>

          {/* CSV Format Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Expected CSV columns:</p>
            <p>link/url, title, date, impressions/views, likes, comments/replies, shares/reposts, engagements</p>
          </div>

          {/* Upload Status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{csvFile ? "1 file selected" : "No file selected"}</span>
          </div>

          <Button
            onClick={handleUpload}
            disabled={isUploading || !csvFile}
            className="w-full"
          >
            {isUploading ? "Uploading..." : "Import X Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};