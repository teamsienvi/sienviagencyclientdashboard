import { useState, useRef } from "react";
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
}: XCSVUploadDialogProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "text/csv" || file.name.endsWith('.csv'))) {
      setCsvFile(file);
    } else if (file) {
      toast.error("Please upload a CSV file");
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

  const parseXCSV = (csvText: string): XCSVRow[] => {
    // Handle different line endings (Windows, Mac, Unix)
    const lines = csvText.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return [];

    // Use parseCSVLine for headers too (handles quoted values)
    const headers = parseCSVLine(lines[0]).map(h => 
      h.toLowerCase().replace(/['"]/g, '').trim()
    );
    
    console.log("Parsed headers:", headers);
    const rows: XCSVRow[] = [];

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

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      if (values.length < 2) continue;

      const row: XCSVRow = {};
      headers.forEach((header, index) => {
        const mappedKey = findMappedKey(header);
        if (mappedKey && values[index] !== undefined && values[index] !== '') {
          const value = parseValue(values[index]);
          (row as any)[mappedKey] = value;
        }
      });
      
      console.log("Parsed row:", row);
      
      // Only add rows that have at least a link/url or title, or any numeric data
      if (row.link || row.url || row.title || row.impressions || row.views || row.likes) {
        rows.push(row);
      }
    }

    console.log("Total parsed rows:", rows.length);
    return rows;
  };

  const handleUpload = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select the date range for this data");
      return;
    }

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

      let totalInserted = 0;

      for (const row of parsedData) {
        const contentId = row.link || row.url || `x_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const publishedAt = row.date ? new Date(row.date).toISOString() : new Date().toISOString();

        // Check if content already exists
        const { data: existingContent } = await supabase
          .from("social_content")
          .select("id")
          .eq("client_id", clientId)
          .eq("platform", "x")
          .eq("content_id", contentId)
          .maybeSingle();

        let contentDbId: string;

        if (existingContent) {
          contentDbId = existingContent.id;
        } else {
          // Insert new social_content
          const { data: newContent, error: contentError } = await supabase
            .from("social_content")
            .insert({
              client_id: clientId,
              platform: "x",
              content_id: contentId,
              content_type: "tweet",
              title: row.title || null,
              url: row.link || row.url || null,
              published_at: publishedAt,
            })
            .select("id")
            .single();

          if (contentError) {
            console.error("Error inserting content:", contentError);
            continue;
          }
          contentDbId = newContent.id;
        }

        // Insert metrics
        const { error: metricsError } = await supabase
          .from("social_content_metrics")
          .insert({
            social_content_id: contentDbId,
            platform: "x",
            period_start: periodStart,
            period_end: periodEnd,
            impressions: row.impressions || row.views || 0,
            views: row.views || row.impressions || 0,
            likes: row.likes || 0,
            comments: row.comments || row.replies || 0,
            shares: row.shares || row.reposts || 0,
            engagements: row.engagements || ((row.likes || 0) + (row.comments || row.replies || 0) + (row.shares || row.reposts || 0)),
          });

        if (metricsError) {
          console.error("Error inserting metrics:", metricsError);
          continue;
        }

        totalInserted++;
      }

      // Calculate and insert account-level metrics
      const totalViews = parsedData.reduce((sum, r) => sum + (r.views || r.impressions || 0), 0);
      const totalLikes = parsedData.reduce((sum, r) => sum + (r.likes || 0), 0);
      const totalComments = parsedData.reduce((sum, r) => sum + (r.comments || r.replies || 0), 0);
      const totalShares = parsedData.reduce((sum, r) => sum + (r.shares || r.reposts || 0), 0);
      const totalEngagements = totalLikes + totalComments + totalShares;
      const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

      await supabase.from("social_account_metrics").insert({
        client_id: clientId,
        platform: "x",
        period_start: periodStart,
        period_end: periodEnd,
        total_content: parsedData.length,
        engagement_rate: engagementRate,
      });

      toast.success(`Imported ${totalInserted} X posts successfully!`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["social-content-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["top-performing-posts"] });
      queryClient.invalidateQueries({ queryKey: ["client-social-metrics"] });
      
      setOpen(false);
      resetForm();
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
            disabled={isUploading || !csvFile || !periodStart || !periodEnd}
            className="w-full"
          >
            {isUploading ? "Uploading..." : "Import X Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};