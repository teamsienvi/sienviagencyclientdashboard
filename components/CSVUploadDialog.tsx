import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseCombinedCSV, PlatformContentCSVRow } from "@/utils/csvParser";

interface CSVUploadDialogProps {
  clientName: string;
  clientId?: string;
  trigger?: React.ReactNode;
}

export const CSVUploadDialog = ({
  clientName,
  clientId,
  trigger,
}: CSVUploadDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleUpload = async () => {
    if (!dateRange || !weekStart || !weekEnd) {
      toast.error("Please fill in the date range and week dates");
      return;
    }

    if (!csvFile) {
      toast.error("Please upload a CSV file");
      return;
    }

    setIsUploading(true);

    try {
      // Read and parse the CSV
      const csvText = await readFileAsText(csvFile);
      const parsedData = parseCombinedCSV(csvText);
      
      // Validate we have some data
      if (parsedData.topPosts.length === 0 && parsedData.platformData.length === 0 && parsedData.platformContent.length === 0) {
        toast.error("Could not parse any data from the CSV. Please check the format.");
        setIsUploading(false);
        return;
      }

      // First, get or create the client
      let actualClientId = clientId;
      
      if (!actualClientId) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("name", clientName)
          .maybeSingle();

        if (existingClient) {
          actualClientId = existingClient.id;
        } else {
          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert({ name: clientName })
            .select("id")
            .single();

          if (clientError) throw clientError;
          actualClientId = newClient.id;
        }
      }

      // Create the report
      const { data: report, error: reportError } = await supabase
        .from("reports")
        .insert({
          client_id: actualClientId,
          date_range: dateRange,
          week_start: weekStart,
          week_end: weekEnd,
        })
        .select("id")
        .single();

      if (reportError) throw reportError;

      // Insert top performing posts
      if (parsedData.topPosts.length > 0) {
        const { error } = await supabase.from("top_performing_posts").insert(
          parsedData.topPosts.map((post) => ({
            report_id: report.id,
            link: post.link || "",
            views: post.views || 0,
            engagement_percent: post.engagementPercent || 0,
            platform: post.platform || "",
            followers: post.followers || 0,
            reach_tier: post.reachTier || null,
            engagement_tier: post.engagementTier || null,
            influence: post.influence || 0,
          }))
        );
        if (error) throw error;
      }

      // Insert platform data
      if (parsedData.platformData.length > 0) {
        const { error } = await supabase.from("platform_data").insert(
          parsedData.platformData.map((pd) => ({
            report_id: report.id,
            platform: pd.platform || "",
            followers: pd.followers || 0,
            new_followers: pd.newFollowers || 0,
            engagement_rate: pd.engagementRate || 0,
            last_week_engagement_rate: pd.lastWeekEngagementRate || 0,
            total_content: pd.totalContent || 0,
            last_week_total_content: pd.lastWeekTotalContent || 0,
          }))
        );
        if (error) throw error;
      }

      // Insert platform content
      if (parsedData.platformContent.length > 0) {
        // Group by platform
        const contentByPlatform: Record<string, PlatformContentCSVRow[]> = {};
        parsedData.platformContent.forEach((content) => {
          const platform = content.platform || "Unknown";
          if (!contentByPlatform[platform]) {
            contentByPlatform[platform] = [];
          }
          contentByPlatform[platform].push(content);
        });

        // Insert platform_data entries for each platform and then content
        for (const [platform, contents] of Object.entries(contentByPlatform)) {
          // Get or create platform_data entry
          let platformDataId: string;

          const { data: existingPd } = await supabase
            .from("platform_data")
            .select("id")
            .eq("report_id", report.id)
            .eq("platform", platform)
            .maybeSingle();

          if (existingPd) {
            platformDataId = existingPd.id;
          } else {
            const { data: newPd, error: pdError } = await supabase
              .from("platform_data")
              .insert({
                report_id: report.id,
                platform: platform,
              })
              .select("id")
              .single();

            if (pdError) throw pdError;
            platformDataId = newPd.id;
          }

          // Insert content
          const { error: contentError } = await supabase
            .from("platform_content")
            .insert(
              contents.map((c) => ({
                platform_data_id: platformDataId,
                content_type: c.contentType || "Post",
                post_date: c.postDate || new Date().toISOString().split("T")[0],
                reach: c.reach || 0,
                views: c.views || 0,
                likes: c.likes || 0,
                comments: c.comments || 0,
                shares: c.shares || 0,
                interactions: c.interactions || 0,
                impressions: c.impressions || 0,
                engagements: c.engagements || 0,
                profile_visits: c.profileVisits || 0,
                link_clicks: c.linkClicks || 0,
              }))
            );

          if (contentError) throw contentError;
        }
      }

      const parsedCount = parsedData.topPosts.length + parsedData.platformData.length + parsedData.platformContent.length;
      toast.success(`Report created! Imported ${parsedCount} records.`);
      setOpen(false);
      resetForm();
      
      // Navigate to the dynamic report page
      router.push(`/report/${report.id}`);
    } catch (error) {
      console.error("Error uploading CSV:", error);
      toast.error("Failed to upload CSV. Please check the format and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setDateRange("");
    setWeekStart("");
    setWeekEnd("");
    setCsvFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Report for {clientName}
          </DialogTitle>
          <DialogDescription>
            Upload a single CSV file containing all report data to create a new weekly report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Range Info */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range Label</Label>
              <Input
                id="dateRange"
                placeholder="e.g., Nov 24-30"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weekStart">Week Start</Label>
                <Input
                  id="weekStart"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekEnd">Week End</Label>
                <Input
                  id="weekEnd"
                  type="date"
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Single CSV Upload */}
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
            <p className="text-xs text-muted-foreground mt-3">
              Include sections for: Top Posts, Platform Data, and Content
            </p>
          </div>

          {/* CSV Format Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Expected CSV Format:</p>
            <div className="space-y-1">
              <p><span className="font-medium">Top Posts:</span> link, views, engagement%, platform, followers, reachTier, engagementTier</p>
              <p><span className="font-medium">Platforms:</span> platform, followers, newFollowers, engagementRate, totalContent</p>
              <p><span className="font-medium">Content:</span> platform, type, date, reach, views, likes, comments, shares</p>
            </div>
            <p className="text-[10px] opacity-70">Sections can be separated by empty lines or section headers like [TOP_POSTS], [PLATFORM_DATA], [PLATFORM_CONTENT]</p>
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
            {isUploading ? "Uploading..." : "Create Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
