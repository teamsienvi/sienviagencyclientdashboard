import { useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  parseCSV,
  topPostsHeaderMap,
  platformDataHeaderMap,
  platformContentHeaderMap,
  TopPostCSVRow,
  PlatformDataCSVRow,
  PlatformContentCSVRow,
} from "@/utils/csvParser";

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
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [topPostsFile, setTopPostsFile] = useState<File | null>(null);
  const [platformDataFile, setPlatformDataFile] = useState<File | null>(null);
  const [platformContentFile, setPlatformContentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const topPostsRef = useRef<HTMLInputElement>(null);
  const platformDataRef = useRef<HTMLInputElement>(null);
  const platformContentRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    const file = e.target.files?.[0];
    if (file && file.type === "text/csv") {
      setter(file);
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

    if (!topPostsFile && !platformDataFile && !platformContentFile) {
      toast.error("Please upload at least one CSV file");
      return;
    }

    setIsUploading(true);

    try {
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

      // Parse and insert top performing posts
      if (topPostsFile) {
        const csvText = await readFileAsText(topPostsFile);
        const topPosts = parseCSV<TopPostCSVRow>(csvText, topPostsHeaderMap);

        if (topPosts.length > 0) {
          const { error } = await supabase.from("top_performing_posts").insert(
            topPosts.map((post) => ({
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
      }

      // Parse and insert platform data
      if (platformDataFile) {
        const csvText = await readFileAsText(platformDataFile);
        const platformData = parseCSV<PlatformDataCSVRow>(csvText, platformDataHeaderMap);

        if (platformData.length > 0) {
          const { error } = await supabase.from("platform_data").insert(
            platformData.map((pd) => ({
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
      }

      // Parse and insert platform content
      if (platformContentFile) {
        const csvText = await readFileAsText(platformContentFile);
        const platformContent = parseCSV<PlatformContentCSVRow>(csvText, platformContentHeaderMap);

        // Group by platform
        const contentByPlatform: Record<string, PlatformContentCSVRow[]> = {};
        platformContent.forEach((content) => {
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

      toast.success(`Report created for ${clientName} - ${dateRange}`);
      setOpen(false);
      resetForm();
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
    setTopPostsFile(null);
    setPlatformDataFile(null);
    setPlatformContentFile(null);
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
            Upload CSV files to create a new weekly report. You can upload one or more CSV files.
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

          {/* CSV Upload Tabs */}
          <Tabs defaultValue="top-posts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="top-posts" className="text-xs">Top Posts</TabsTrigger>
              <TabsTrigger value="platform-data" className="text-xs">Platforms</TabsTrigger>
              <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
            </TabsList>

            <TabsContent value="top-posts" className="space-y-3">
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  ref={topPostsRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, setTopPostsFile)}
                />
                <Button
                  variant="ghost"
                  onClick={() => topPostsRef.current?.click()}
                  className="gap-2"
                >
                  {topPostsFile ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      {topPostsFile.name}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Top Posts CSV
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Columns: link, views, engagement%, platform, followers, reachTier, engagementTier
                </p>
              </div>
            </TabsContent>

            <TabsContent value="platform-data" className="space-y-3">
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  ref={platformDataRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, setPlatformDataFile)}
                />
                <Button
                  variant="ghost"
                  onClick={() => platformDataRef.current?.click()}
                  className="gap-2"
                >
                  {platformDataFile ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      {platformDataFile.name}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Platform Data CSV
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Columns: platform, followers, newFollowers, engagementRate, totalContent
                </p>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-3">
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input
                  ref={platformContentRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, setPlatformContentFile)}
                />
                <Button
                  variant="ghost"
                  onClick={() => platformContentRef.current?.click()}
                  className="gap-2"
                >
                  {platformContentFile ? (
                    <>
                      <Check className="h-4 w-4 text-green-500" />
                      {platformContentFile.name}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload Content CSV
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Columns: platform, type, date, reach, views, likes, comments, shares
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Upload Status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              {[topPostsFile, platformDataFile, platformContentFile].filter(Boolean).length} file(s) selected
            </span>
          </div>

          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? "Uploading..." : "Create Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
