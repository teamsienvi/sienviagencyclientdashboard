import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Search, Download, ExternalLink, Activity, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

// TypeScript Interfaces
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
  reach?: number;
  views?: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
  linkClicks?: number;
  impressions?: number;
  engagements?: number;
  profileVisits?: number;
}

interface PlatformData {
  name: string;
  followers: number;
  newFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
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
    postLink: "https://www.facebook.com/reel/833087389335445/",
    views: 346,
    engagementPercent: "4.62%",
    platform: "Facebook",
    followers: 72,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 53,
    postTier: "4 (Presence)",
    notes: "Solid reach and moderate engagement position this post in the presence tier.",
  },
  {
    postLink: "https://www.facebook.com/reel/1903775023907922",
    views: 265,
    engagementPercent: "3.40%",
    platform: "Facebook",
    followers: 72,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 49,
    postTier: "4 (Presence)",
    notes: "Engagement is steady but not strong enough to elevate performance.",
  },
  {
    postLink: "https://www.facebook.com/reel/1847320322572282/",
    views: 187,
    engagementPercent: "10.16%",
    platform: "Facebook",
    followers: 72,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 59,
    postTier: "3 (Growth)",
    notes: "High engagement drives strong performance despite lower reach.",
  },
];

// Platform Data
const platformsData: Record<string, PlatformData> = {
  instagram: {
    name: "Instagram",
    followers: 29,
    newFollowers: 0,
    engagementRate: 57.45,
    lastWeekEngagementRate: 52.21,
    totalContent: 10,
    lastWeekTotalContent: 11,
    content: [
      { type: "Photo", date: "Monday, Nov 24", reach: 5, views: 16, likes: 4, comments: 3, shares: 0, interactions: 7 },
      { type: "Photo", date: "Tuesday, Nov 25", reach: 6, views: 12, likes: 3, comments: 2, shares: 0, interactions: 5 },
      { type: "Reel", date: "Tuesday, Nov 25", reach: 5, views: 40, likes: 4, comments: 3, shares: 1, interactions: 8 },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 19, views: 13, likes: 4, comments: 3, shares: 0, interactions: 7 },
      { type: "Reel", date: "Thursday, Nov 27", reach: 5, views: 19, likes: 5, comments: 3, shares: 0, interactions: 8 },
      { type: "Photo", date: "Thursday, Nov 27", reach: 13, views: 14, likes: 2, comments: 2, shares: 0, interactions: 4 },
      { type: "Reel", date: "Friday, Nov 28", reach: 4, views: 27, likes: 5, comments: 3, shares: 0, interactions: 8 },
      { type: "Photo", date: "Friday, Nov 28", reach: 27, views: 10, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Photo", date: "Saturday, Nov 29", reach: 5, views: 9, likes: 1, comments: 0, shares: 0, interactions: 1 },
      { type: "Photo", date: "Sunday, Nov 30", reach: 5, views: 12, likes: 0, comments: 0, shares: 0, interactions: 0 },
    ],
  },
  facebook: {
    name: "Facebook",
    followers: 72,
    newFollowers: 1,
    engagementRate: 53.63,
    lastWeekEngagementRate: 42.60,
    totalContent: 11,
    lastWeekTotalContent: 11,
    content: [
      { type: "Photo", date: "Monday, Nov 24", reach: 18, views: 30, likes: 7, comments: 0, shares: 5, interactions: 12, linkClicks: 1 },
      { type: "Photo", date: "Tuesday, Nov 25", reach: 48, views: 69, likes: 7, comments: 0, shares: 1, interactions: 8, linkClicks: 0 },
      { type: "Reel", date: "Tuesday, Nov 25", reach: 16, views: 265, likes: 8, comments: 0, shares: 1, interactions: 9, linkClicks: 0 },
      { type: "Reel", date: "Wednesday, Nov 26", reach: 241, views: 187, likes: 8, comments: 0, shares: 11, interactions: 19, linkClicks: 1 },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 20, views: 46, likes: 7, comments: 0, shares: 5, interactions: 12, linkClicks: 0 },
      { type: "Reel", date: "Thursday, Nov 27", reach: 77, views: 122, likes: 8, comments: 1, shares: 1, interactions: 10, linkClicks: 0 },
      { type: "Photo", date: "Thursday, Nov 27", reach: 19, views: 33, likes: 7, comments: 0, shares: 0, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Friday, Nov 28", reach: 84, views: 346, likes: 6, comments: 0, shares: 10, interactions: 16, linkClicks: 0 },
      { type: "Photo", date: "Friday, Nov 28", reach: 230, views: 37, likes: 6, comments: 0, shares: 4, interactions: 10, linkClicks: 0 },
      { type: "Photo", date: "Saturday, Nov 29", reach: 42, views: 80, likes: 2, comments: 0, shares: 1, interactions: 3, linkClicks: 0 },
      { type: "Photo", date: "Sunday, Nov 30", reach: 18, views: 33, likes: 2, comments: 0, shares: 1, interactions: 3, linkClicks: 0 },
    ],
  },
  tiktok: {
    name: "TikTok",
    followers: 5,
    newFollowers: 0,
    engagementRate: 3.21,
    lastWeekEngagementRate: 2.16,
    totalContent: 11,
    lastWeekTotalContent: 11,
    content: [
      { type: "Video", date: "Monday, Nov 24", views: 99, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Tuesday, Nov 25", views: 98, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Tuesday, Nov 25", views: 92, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Wednesday, Nov 26", views: 95, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Wednesday, Nov 26", views: 103, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Thursday, Nov 27", views: 98, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Thursday, Nov 27", views: 98, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Friday, Nov 28", views: 95, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Friday, Nov 28", views: 105, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Saturday, Nov 29", views: 105, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Video", date: "Sunday, Nov 30", views: 95, likes: 0, comments: 0, shares: 0, interactions: 0 },
    ],
  },
  x: {
    name: "X",
    followers: 9,
    newFollowers: 0,
    engagementRate: 71.43,
    lastWeekEngagementRate: 24.83,
    totalContent: 11,
    lastWeekTotalContent: 9,
    content: [
      { type: "Post", date: "Tuesday, Nov 25", impressions: 6, engagements: 5, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 5 },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 9, engagements: 5, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 5 },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 9, engagements: 4, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 4 },
      { type: "Post", date: "Wednesday, Nov 26", impressions: 5, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Wednesday, Nov 26", impressions: 5, engagements: 5, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 5 },
      { type: "Post", date: "Thursday, Nov 27", impressions: 5, engagements: 5, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 5 },
      { type: "Post", date: "Thursday, Nov 27", impressions: 7, engagements: 5, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 5 },
      { type: "Post", date: "Friday, Nov 28", impressions: 2, engagements: 0, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Post", date: "Friday, Nov 28", impressions: 4, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Saturday, Nov 29", impressions: 3, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Sunday, Nov 30", impressions: 1, engagements: 1, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 1 },
    ],
  },
};

// Chart Data
const chartData: ChartData[] = [
  { platform: "Instagram", followers: 29, views: 172, interactions: 54 },
  { platform: "Facebook", followers: 72, views: 1248, interactions: 109 },
  { platform: "TikTok", followers: 5, views: 585, interactions: 0 },
  { platform: "X", followers: 9, views: 56, interactions: 40 },
];

const TheHavenAtDeerParkNov24to30 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [platformSearch, setPlatformSearch] = useState("");
  const [contentFilter, setContentFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("instagram");

  // Filter top performing posts
  const filteredTopPosts = topPerformingPosts.filter(
    (post) =>
      post.postLink.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
      post.platform.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
      post.notes.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  // Filter platform content
  const getFilteredContent = (platform: string) => {
    const data = platformsData[platform];
    if (!data) return [];
    return data.content.filter((item) => {
      const matchesSearch =
        item.type.toLowerCase().includes(platformSearch.toLowerCase()) ||
        item.date.toLowerCase().includes(platformSearch.toLowerCase());
      const matchesFilter = contentFilter === "All" || item.type === contentFilter;
      return matchesSearch && matchesFilter;
    });
  };

  // Export CSV function
  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  // Tooltip definitions
  const reachTierTooltip = "Tier 1: 1M+ views\nTier 2: 500K-1M\nTier 3: 100K-500K\nTier 4: 50K-100K\nTier 5: <50K";
  const engagementTierTooltip = "Tier 1: 8%+ engagement\nTier 2: 5-8%\nTier 3: 3-5%\nTier 4: 1-3%\nTier 5: <1%";
  const influenceTooltip = "Quality of interactions:\n• Mentions from authority accounts\n• Shares by influencers\n• Media pickups\nScale: 1-5";
  const conversionTooltip = "Conversion signals:\n• Click-throughs\n• DM inquiries\n• Newsletter signups\n• Purchases\nScale: 1-5";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-primary">SIENVI AGENCY</h1>
                  <p className="text-muted-foreground">Client Dashboard</p>
                </div>
              </div>
              <Button variant="outline" className="gap-2">
                <Activity className="h-4 w-4" />
                Live Data
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 space-y-8">
          {/* Client Info */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-foreground">The Haven at Deer Park</h2>
            <p className="text-muted-foreground text-lg">Weekly Performance Insights (Nov 24-30)</p>
          </div>

          {/* Top Performing Insights */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle className="text-xl">Top Performing Insights</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search posts..."
                      value={topPostsSearch}
                      onChange={(e) => setTopPostsSearch(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                  <Button variant="outline" onClick={() => exportToCSV(topPerformingPosts, "top-performing-posts.csv")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post Link</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Engagement %</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Followers</TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help underline decoration-dotted">Reach Tier</TooltipTrigger>
                          <TooltipContent className="whitespace-pre-line max-w-xs">{reachTierTooltip}</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help underline decoration-dotted">Engagement Tier</TooltipTrigger>
                          <TooltipContent className="whitespace-pre-line max-w-xs">{engagementTierTooltip}</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help underline decoration-dotted">Influence</TooltipTrigger>
                          <TooltipContent className="whitespace-pre-line max-w-xs">{influenceTooltip}</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help underline decoration-dotted">Conversion</TooltipTrigger>
                          <TooltipContent className="whitespace-pre-line max-w-xs">{conversionTooltip}</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>Total Score ↓</TableHead>
                      <TableHead>Post Tier</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTopPosts.map((post, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <a href={post.postLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            View Post <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>{post.views.toLocaleString()}</TableCell>
                        <TableCell>{post.engagementPercent}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{post.platform}</Badge>
                        </TableCell>
                        <TableCell>{post.followers.toLocaleString()}</TableCell>
                        <TableCell>{post.reachTier}</TableCell>
                        <TableCell>{post.engagementTier}</TableCell>
                        <TableCell>{post.influence}</TableCell>
                        <TableCell>{post.conversion}</TableCell>
                        <TableCell className="font-semibold">{post.totalScore}</TableCell>
                        <TableCell>{post.postTier}</TableCell>
                        <TableCell className="max-w-xs truncate">{post.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Platform Performance Overview Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Platform Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="platform" className="text-xs" />
                    <YAxis className="text-xs" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="followers" name="Followers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="views" name="Total Views/Impressions" fill="hsl(var(--primary) / 0.6)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="interactions" name="Total Interactions" fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Platform Content Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Platform Content Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="x">X</TabsTrigger>
                </TabsList>

                {Object.entries(platformsData).map(([key, platform]) => (
                  <TabsContent key={key} value={key} className="space-y-6">
                    {/* Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Followers</p>
                            <p className="text-3xl font-bold text-foreground">{platform.followers.toLocaleString()}</p>
                            {platform.newFollowers > 0 && (
                              <p className="text-sm text-green-500 font-medium">+{platform.newFollowers} new</p>
                            )}
                            {platform.newFollowers === 0 && (
                              <p className="text-sm text-muted-foreground">No change</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Engagement Rate</p>
                            <div className="flex items-center justify-center gap-2">
                              <p className="text-3xl font-bold text-foreground">{platform.engagementRate}%</p>
                              {platform.engagementRate > platform.lastWeekEngagementRate ? (
                                <TrendingUp className="h-5 w-5 text-green-500" />
                              ) : (
                                <TrendingDown className="h-5 w-5 text-red-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Last week: {platform.lastWeekEngagementRate}%</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Total Content</p>
                            <div className="flex items-center justify-center gap-2">
                              <p className="text-3xl font-bold text-foreground">{platform.totalContent}</p>
                              {platform.totalContent > platform.lastWeekTotalContent ? (
                                <TrendingUp className="h-5 w-5 text-green-500" />
                              ) : platform.totalContent < platform.lastWeekTotalContent ? (
                                <TrendingDown className="h-5 w-5 text-red-500" />
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">Last week: {platform.lastWeekTotalContent}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {["All", "Reel", "Photo", "Video", "Post"].map((filter) => (
                          <Button
                            key={filter}
                            variant={contentFilter === filter ? "default" : "outline"}
                            size="sm"
                            onClick={() => setContentFilter(filter)}
                          >
                            {filter}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search content..."
                            value={platformSearch}
                            onChange={(e) => setPlatformSearch(e.target.value)}
                            className="pl-9 w-full sm:w-64"
                          />
                        </div>
                        <Button variant="outline" onClick={() => exportToCSV(platform.content, `${key}-content.csv`)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Content Table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                            {key === "instagram" && (
                              <>
                                <TableHead>Reach</TableHead>
                                <TableHead>Views</TableHead>
                                <TableHead>Likes & Reactions</TableHead>
                                <TableHead>Comments</TableHead>
                                <TableHead>Shares</TableHead>
                                <TableHead>Interactions</TableHead>
                              </>
                            )}
                            {key === "facebook" && (
                              <>
                                <TableHead>Reach</TableHead>
                                <TableHead>Views</TableHead>
                                <TableHead>Likes & Reactions</TableHead>
                                <TableHead>Comments</TableHead>
                                <TableHead>Shares</TableHead>
                                <TableHead>Interactions</TableHead>
                                <TableHead>Link Clicks</TableHead>
                              </>
                            )}
                            {key === "tiktok" && (
                              <>
                                <TableHead>Views</TableHead>
                                <TableHead>Likes</TableHead>
                                <TableHead>Comments</TableHead>
                                <TableHead>Shares</TableHead>
                                <TableHead>Interactions</TableHead>
                              </>
                            )}
                            {key === "x" && (
                              <>
                                <TableHead>Impressions</TableHead>
                                <TableHead>Engagements</TableHead>
                                <TableHead>Profile Visits</TableHead>
                                <TableHead>Link Clicks</TableHead>
                              </>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredContent(key).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Badge variant={item.type === "Reel" || item.type === "Video" ? "default" : "secondary"}>
                                  {item.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.date}</TableCell>
                              {key === "instagram" && (
                                <>
                                  <TableCell>{item.reach?.toLocaleString()}</TableCell>
                                  <TableCell>{item.views?.toLocaleString()}</TableCell>
                                  <TableCell>{item.likes.toLocaleString()}</TableCell>
                                  <TableCell>{item.comments.toLocaleString()}</TableCell>
                                  <TableCell>{item.shares.toLocaleString()}</TableCell>
                                  <TableCell>{item.interactions.toLocaleString()}</TableCell>
                                </>
                              )}
                              {key === "facebook" && (
                                <>
                                  <TableCell>{item.reach?.toLocaleString()}</TableCell>
                                  <TableCell>{item.views?.toLocaleString()}</TableCell>
                                  <TableCell>{item.likes.toLocaleString()}</TableCell>
                                  <TableCell>{item.comments.toLocaleString()}</TableCell>
                                  <TableCell>{item.shares.toLocaleString()}</TableCell>
                                  <TableCell>{item.interactions.toLocaleString()}</TableCell>
                                  <TableCell>{item.linkClicks?.toLocaleString()}</TableCell>
                                </>
                              )}
                              {key === "tiktok" && (
                                <>
                                  <TableCell>{item.views?.toLocaleString()}</TableCell>
                                  <TableCell>{item.likes.toLocaleString()}</TableCell>
                                  <TableCell>{item.comments.toLocaleString()}</TableCell>
                                  <TableCell>{item.shares.toLocaleString()}</TableCell>
                                  <TableCell>{item.interactions.toLocaleString()}</TableCell>
                                </>
                              )}
                              {key === "x" && (
                                <>
                                  <TableCell>{item.impressions?.toLocaleString()}</TableCell>
                                  <TableCell>{item.engagements?.toLocaleString()}</TableCell>
                                  <TableCell>{item.profileVisits?.toLocaleString()}</TableCell>
                                  <TableCell>{item.linkClicks?.toLocaleString()}</TableCell>
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

export default TheHavenAtDeerParkNov24to30;
