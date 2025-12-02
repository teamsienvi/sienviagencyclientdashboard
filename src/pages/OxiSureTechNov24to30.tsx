import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Search, Download, Activity, TrendingUp, TrendingDown, ExternalLink, Info } from "lucide-react";
import { Link } from "react-router-dom";

// TypeScript interfaces
interface TopPerformingPost {
  postLink: string;
  views: number;
  engagementPercent: string;
  platform: string;
  followers: number;
  reachTier: string;
  engagementTier: string;
  influence: number;
  conversion: number;
  totalScore: number;
  postTier: string;
  notes: string;
}

interface PlatformMetric {
  type: string;
  date: string;
  reach?: number | string;
  views?: number;
  likesReactions?: number;
  comments?: number;
  shares?: number;
  interactions?: number;
  linkClicks?: number | string;
  impressions?: number;
  engagements?: number;
  profileVisits?: number | string;
}

interface PlatformData {
  followers: number;
  newFollowers: number;
  engagementRate: string;
  lastWeekEngagementRate: string;
  totalContent: number;
  lastWeekTotalContent: number;
  content: PlatformMetric[];
}

interface ChartData {
  platform: string;
  followers: number;
  views: number;
  interactions: number;
}

// Top Performing Posts Data
const topPerformingPosts: TopPerformingPost[] = [
  {
    postLink: "https://www.tiktok.com/@oxisuretech/video/7575596131602763064",
    views: 100,
    engagementPercent: "2.00%",
    platform: "TikTok",
    followers: 6,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 3,
    conversion: 3,
    totalScore: 38,
    postTier: "5 (Awareness)",
    notes: "low engagement",
  },
  {
    postLink: "https://www.tiktok.com/@oxisuretech/video/7575993757028355340",
    views: 101,
    engagementPercent: "1.96%",
    platform: "TikTok",
    followers: 6,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 3,
    conversion: 3,
    totalScore: 38,
    postTier: "5 (Awareness)",
    notes: "low engagement",
  },
  {
    postLink: "https://www.tiktok.com/@oxisuretech/video/7574498090304933176",
    views: 100,
    engagementPercent: "2.00%",
    platform: "TikTok",
    followers: 6,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 3,
    conversion: 3,
    totalScore: 38,
    postTier: "4 (Presence)",
    notes: "Engagement is moderate",
  },
];

// Platform Data
const platformsData: Record<string, PlatformData> = {
  Instagram: {
    followers: 9,
    newFollowers: 0,
    engagementRate: "No data",
    lastWeekEngagementRate: "50.42%",
    totalContent: 12,
    lastWeekTotalContent: 14,
    content: [
      { type: "Photo", date: "Monday, Nov 24", reach: 1, views: 4, likesReactions: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Reel", date: "Monday, Nov 24", reach: "No data", views: 5, likesReactions: 4, comments: 4, shares: 0, interactions: 8 },
      { type: "Photo", date: "Tuesday, Nov 25", reach: "No data", views: 6, likesReactions: 5, comments: 4, shares: 0, interactions: 9 },
      { type: "Photo", date: "Tuesday, Nov 25", reach: "No data", views: 5, likesReactions: 4, comments: 4, shares: 0, interactions: 8 },
      { type: "Photo", date: "Wednesday, Nov 26", reach: "No data", views: 4, likesReactions: 4, comments: 4, shares: 0, interactions: 8 },
      { type: "Photo", date: "Wednesday, Nov 26", reach: "No data", views: 5, likesReactions: 4, comments: 4, shares: 0, interactions: 8 },
      { type: "Photo", date: "Thursday, Nov 27", reach: "No data", views: 7, likesReactions: 4, comments: 4, shares: 0, interactions: 8 },
      { type: "Photo", date: "Friday, Nov 28", reach: 1, views: 6, likesReactions: 4, comments: 4, shares: 0, interactions: 8 },
      { type: "Photo", date: "Saturday, Nov 29", reach: "No data", views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Photo", date: "Saturday, Nov 29", reach: "No data", views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Photo", date: "Sunday, Nov 30", reach: "No data", views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Photo", date: "Sunday, Nov 30", reach: "No data", views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
    ],
  },
  Facebook: {
    followers: 23,
    newFollowers: 0,
    engagementRate: "105.00%",
    lastWeekEngagementRate: "82.60%",
    totalContent: 13,
    lastWeekTotalContent: 14,
    content: [
      { type: "Photo", date: "Monday, Nov 24", reach: 9, views: 17, likesReactions: 7, comments: 0, shares: 0, interactions: 7, linkClicks: "No data" },
      { type: "Reel", date: "Monday, Nov 24", reach: 12, views: 45, likesReactions: 7, comments: 0, shares: 4, interactions: 11, linkClicks: "No data" },
      { type: "Photo", date: "Tuesday, Nov 25", reach: 7, views: 9, likesReactions: 6, comments: 0, shares: 0, interactions: 6, linkClicks: "No data" },
      { type: "Photo", date: "Tuesday, Nov 25", reach: 8, views: 11, likesReactions: 6, comments: 0, shares: 0, interactions: 6, linkClicks: "No data" },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 8, views: 18, likesReactions: 6, comments: 0, shares: 0, interactions: 6, linkClicks: "No data" },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 9, views: 18, likesReactions: 6, comments: 0, shares: 6, interactions: 12, linkClicks: "No data" },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 8, views: 18, likesReactions: 6, comments: 0, shares: 0, interactions: 6, linkClicks: "No data" },
      { type: "Photo", date: "Thursday, Nov 27", reach: 8, views: 21, likesReactions: 6, comments: 0, shares: 13, interactions: 19, linkClicks: "No data" },
      { type: "Photo", date: "Friday, Nov 28", reach: 7, views: 10, likesReactions: 5, comments: 0, shares: 6, interactions: 11, linkClicks: "No data" },
      { type: "Photo", date: "Saturday, Nov 29", reach: 1, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "No data" },
      { type: "Photo", date: "Saturday, Nov 29", reach: 1, views: 4, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "No data" },
      { type: "Photo", date: "Sunday, Nov 30", reach: 1, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "No data" },
      { type: "Photo", date: "Sunday, Nov 30", reach: 1, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "No data" },
    ],
  },
  TikTok: {
    followers: 6,
    newFollowers: 0,
    engagementRate: "29.20%",
    lastWeekEngagementRate: "27.60%",
    totalContent: 12,
    lastWeekTotalContent: 6,
    content: [
      { type: "Video", date: "Monday, Nov 24", views: 91, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Monday, Nov 24", views: 91, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Tuesday, Nov 25", views: 91, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Tuesday, Nov 25", views: 99, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Wednesday, Nov 26", views: 98, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Wednesday, Nov 26", views: 98, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Thursday, Nov 27", views: 94, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Friday, Nov 28", views: 91, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Friday, Nov 28", views: 96, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Saturday, Nov 29", views: 97, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Saturday, Nov 29", views: 95, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Video", date: "Sunday, Nov 30", views: 100, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
    ],
  },
  X: {
    followers: 10,
    newFollowers: 1,
    engagementRate: "80.00%",
    lastWeekEngagementRate: "59.26%",
    totalContent: 17,
    lastWeekTotalContent: 12,
    content: [
      { type: "Post", date: "Monday, Nov 24", impressions: 9, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Monday, Nov 24", impressions: 7, engagements: 8, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Monday, Nov 24", impressions: 9, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 10, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 9, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 7, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 13, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Wednesday, Nov 26", impressions: 12, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Thursday, Nov 27", impressions: 8, engagements: 7, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Friday, Nov 28", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Friday, Nov 28", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Saturday, Nov 29", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Saturday, Nov 29", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Saturday, Nov 29", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Saturday, Nov 29", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Sunday, Nov 30", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
      { type: "Post", date: "Sunday, Nov 30", impressions: 2, engagements: 2, profileVisits: "-", linkClicks: "-" },
    ],
  },
};

// Chart Data
const chartData: ChartData[] = [
  { platform: "Instagram", followers: 9, views: 44, interactions: 63 },
  { platform: "Facebook", followers: 23, views: 177, interactions: 84 },
  { platform: "TikTok", followers: 6, views: 1141, interactions: 20 },
  { platform: "X", followers: 10, views: 100, interactions: 80 },
];

const OxiSureTechNov24to30 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [platformSearch, setPlatformSearch] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("All");
  const [activePlatform, setActivePlatform] = useState("Instagram");

  const filteredTopPosts = topPerformingPosts.filter(
    (post) =>
      post.postLink.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
      post.platform.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
      post.notes.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  const getFilteredContent = (platform: string) => {
    const data = platformsData[platform];
    if (!data) return [];
    return data.content.filter((item) => {
      const matchesSearch =
        item.type.toLowerCase().includes(platformSearch.toLowerCase()) ||
        item.date.toLowerCase().includes(platformSearch.toLowerCase());
      const matchesType =
        contentTypeFilter === "All" ||
        item.type.toLowerCase().includes(contentTypeFilter.toLowerCase());
      return matchesSearch && matchesType;
    });
  };

  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const parseEngagementRate = (rate: string): number => {
    if (rate === "No data") return 0;
    return parseFloat(rate.replace("%", ""));
  };

  const isEngagementHigher = (current: string, lastWeek: string): boolean | null => {
    if (current === "No data") return null;
    const currentRate = parseEngagementRate(current);
    const lastWeekRate = parseEngagementRate(lastWeek);
    return currentRate > lastWeekRate;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-primary text-primary-foreground py-6 px-4 md:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Link to="/" className="hover:opacity-80 transition-opacity">
                <h1 className="text-2xl md:text-3xl font-bold">SIENVI AGENCY</h1>
              </Link>
              <p className="text-primary-foreground/80 mt-1">Client Dashboard</p>
            </div>
            <Button variant="secondary" className="flex items-center gap-2 w-fit">
              <Activity className="w-4 h-4" />
              Live Data
            </Button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
          {/* Client Info */}
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">OxiSure Tech</h2>
            <p className="text-muted-foreground mt-1">Weekly Performance Insights (Nov 24 - 30)</p>
          </div>

          {/* Top Performing Insights */}
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-xl">Top Performing Insights</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    className="pl-9 w-full sm:w-64"
                    value={topPostsSearch}
                    onChange={(e) => setTopPostsSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => exportToCSV(topPerformingPosts, "oxisure-tech-top-posts-nov24-30")}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post Link</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Engagement %</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Reach Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">Reach Tier</p>
                            <p className="text-xs">Tier 1: 1M+ views</p>
                            <p className="text-xs">Tier 2: 500K – 1M</p>
                            <p className="text-xs">Tier 3: 100K – 500K</p>
                            <p className="text-xs">Tier 4: 50K – 100K</p>
                            <p className="text-xs">Tier 5: &lt;50K</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Engagement Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">Engagement Tier</p>
                            <p className="text-xs">Tier 1: 8%+ engagement rate</p>
                            <p className="text-xs">Tier 2: 5–8%</p>
                            <p className="text-xs">Tier 3: 3–5%</p>
                            <p className="text-xs">Tier 4: 1–3%</p>
                            <p className="text-xs">Tier 5: &lt;1%</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Influence
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">Influence (1-5)</p>
                            <p className="text-xs">Quality of interactions: mentions from authority accounts, shares by influencers, media pickups, collaboration requests</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Conversion
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">Conversion (1-5)</p>
                            <p className="text-xs">Click-throughs, DM inquiries, newsletter signups, purchases directly attributed</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Total Score ↓</TableHead>
                    <TableHead>Post Tier</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPosts.map((post, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <a
                          href={post.postLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Post
                        </a>
                      </TableCell>
                      <TableCell className="text-right">{post.views.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{post.engagementPercent}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.platform}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{post.followers.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{post.reachTier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{post.engagementTier}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{post.influence}</TableCell>
                      <TableCell className="text-center">{post.conversion}</TableCell>
                      <TableCell className="text-right font-semibold">{post.totalScore}</TableCell>
                      <TableCell>
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{post.postTier}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{post.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Platform Performance Overview Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Platform Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="platform" className="text-xs" />
                  <YAxis className="text-xs" />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="followers" name="Followers" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="views" name="Total Views/Impressions" fill="hsl(262, 83%, 70%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interactions" name="Total Interactions" fill="hsl(262, 83%, 82%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform Content Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Platform Content Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activePlatform} onValueChange={setActivePlatform}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="Instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="Facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="TikTok">TikTok</TabsTrigger>
                  <TabsTrigger value="X">X</TabsTrigger>
                </TabsList>

                {Object.entries(platformsData).map(([platform, data]) => (
                  <TabsContent key={platform} value={platform} className="space-y-6">
                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-2xl font-bold text-foreground">{data.followers.toLocaleString()}</p>
                          {data.newFollowers > 0 && (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />+{data.newFollowers} new
                            </p>
                          )}
                          {data.newFollowers === 0 && (
                            <p className="text-sm text-muted-foreground">No new followers</p>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Engagement Rate</p>
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-foreground">{data.engagementRate}</p>
                            {isEngagementHigher(data.engagementRate, data.lastWeekEngagementRate) === true && (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            )}
                            {isEngagementHigher(data.engagementRate, data.lastWeekEngagementRate) === false && (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {data.lastWeekEngagementRate}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-6">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center gap-2">
                            <p className="text-2xl font-bold text-foreground">{data.totalContent}</p>
                            {data.totalContent > data.lastWeekTotalContent && (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            )}
                            {data.totalContent < data.lastWeekTotalContent && (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {data.lastWeekTotalContent}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-2 justify-between">
                      <div className="flex flex-wrap gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search content..."
                            className="pl-9 w-full sm:w-64"
                            value={platformSearch}
                            onChange={(e) => setPlatformSearch(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-1">
                          {["All", "Reel", "Post", "Photo", "Video"].map((type) => (
                            <Button
                              key={type}
                              variant={contentTypeFilter === type ? "default" : "outline"}
                              size="sm"
                              onClick={() => setContentTypeFilter(type)}
                            >
                              {type}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => exportToCSV(data.content, `oxisure-tech-${platform.toLowerCase()}-nov24-30`)}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </Button>
                    </div>

                    {/* Content Table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                            {platform === "X" ? (
                              <>
                                <TableHead className="text-right">Impressions</TableHead>
                                <TableHead className="text-right">Engagements</TableHead>
                                <TableHead className="text-right">Profile Visits</TableHead>
                                <TableHead className="text-right">Link Clicks</TableHead>
                              </>
                            ) : platform === "TikTok" ? (
                              <>
                                <TableHead className="text-right">Views</TableHead>
                                <TableHead className="text-right">Likes</TableHead>
                                <TableHead className="text-right">Comments</TableHead>
                                <TableHead className="text-right">Shares</TableHead>
                                <TableHead className="text-right">Interactions</TableHead>
                              </>
                            ) : (
                              <>
                                <TableHead className="text-right">Reach</TableHead>
                                <TableHead className="text-right">Views</TableHead>
                                <TableHead className="text-right">Likes & Reactions</TableHead>
                                <TableHead className="text-right">Comments</TableHead>
                                <TableHead className="text-right">Shares</TableHead>
                                <TableHead className="text-right">Interactions</TableHead>
                                {platform === "Facebook" && <TableHead className="text-right">Link Clicks</TableHead>}
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredContent(platform).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge
                                  variant={item.type === "Reel" || item.type === "Video" ? "default" : "secondary"}
                                  className={item.type === "Reel" || item.type === "Video" ? "bg-primary" : ""}
                                >
                                  {item.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.date}</TableCell>
                              {platform === "X" ? (
                                <>
                                  <TableCell className="text-right">{item.impressions?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.engagements?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.profileVisits}</TableCell>
                                  <TableCell className="text-right">{item.linkClicks}</TableCell>
                                </>
                              ) : platform === "TikTok" ? (
                                <>
                                  <TableCell className="text-right">{item.views?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.likesReactions?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.comments?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.shares?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.interactions?.toLocaleString()}</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right">{item.reach}</TableCell>
                                  <TableCell className="text-right">{item.views?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.likesReactions?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.comments?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.shares?.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">{item.interactions?.toLocaleString()}</TableCell>
                                  {platform === "Facebook" && <TableCell className="text-right">{item.linkClicks}</TableCell>}
                                </>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default OxiSureTechNov24to30;
