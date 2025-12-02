import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, Search, Download, TrendingUp, TrendingDown, ExternalLink, ArrowLeft, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

// TypeScript Interfaces
interface TopPerformingPost {
  link: string;
  views: number;
  engagement: number;
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
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
  linkClicks?: number;
  impressions?: number;
  engagements?: number;
  profileVisits?: number;
  favorites?: number;
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

// Data from CSV - Serenity Scrolls Nov 17-23
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7575755123918523662",
    views: 298,
    engagement: 27.18,
    platform: "TikTok",
    followers: 70,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 74,
    postTier: "Tier 2 (Influence)",
    notes: "Very strong engagement"
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7574524715847404814",
    views: 270,
    engagement: 26.30,
    platform: "TikTok",
    followers: 70,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 73,
    postTier: "Tier 2 (Influence)",
    notes: "High interaction depth"
  },
  {
    link: "https://www.instagram.com/reel/DRN7pi-FN5I/",
    views: 205,
    engagement: 21.39,
    platform: "Instagram",
    followers: 44,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 3,
    conversion: 3,
    totalScore: 63,
    postTier: "3 (Growth)",
    notes: "Excellent engagement for a low-reach reel"
  }
];

// Platform Data
const platformsData: Record<string, PlatformData> = {
  instagram: {
    name: "Instagram",
    followers: 44,
    newFollowers: 4,
    engagementRate: 36.02,
    lastWeekEngagementRate: 32.02,
    totalContent: 21,
    lastWeekTotalContent: 17,
    content: [
      { type: "Reel", date: "Monday, Nov 17", reach: 15, views: 8, likes: 4, comments: 3, shares: 0, interactions: 7 },
      { type: "Reel", date: "Monday, Nov 17", reach: 207, views: 178, likes: 23, comments: 3, shares: 3, interactions: 29 },
      { type: "Photo", date: "Monday, Nov 17", reach: 9, views: 3, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Photo", date: "Tuesday, Nov 18", reach: 12, views: 5, likes: 3, comments: 4, shares: 0, interactions: 7 },
      { type: "Reel", date: "Tuesday, Nov 18", reach: 145, views: 131, likes: 10, comments: 4, shares: 0, interactions: 14 },
      { type: "Reel", date: "Tuesday, Nov 18", reach: 242, views: 205, likes: 26, comments: 5, shares: 6, interactions: 37 },
      { type: "Photo", date: "Wednesday, Nov 19", reach: 7, views: 3, likes: 2, comments: 2, shares: 0, interactions: 4 },
      { type: "Reel", date: "Wednesday, Nov 19", reach: 152, views: 127, likes: 16, comments: 8, shares: 0, interactions: 25 },
      { type: "Reel", date: "Wednesday, Nov 19", reach: 190, views: 168, likes: 16, comments: 5, shares: 1, interactions: 22 },
      { type: "Reel", date: "Thursday, Nov 20", reach: 121, views: 90, likes: 10, comments: 5, shares: 16, interactions: 31 },
      { type: "Photo", date: "Thursday, Nov 20", reach: 11, views: 7, likes: 2, comments: 2, shares: 0, interactions: 4 },
      { type: "Photo", date: "Thursday, Nov 20", reach: 10, views: 4, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Reel", date: "Friday, Nov 21", reach: 149, views: 130, likes: 17, comments: 2, shares: 0, interactions: 19 },
      { type: "Photo", date: "Friday, Nov 21", reach: 2, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Reel", date: "Friday, Nov 21", reach: 56, views: 54, likes: 2, comments: 0, shares: 0, interactions: 2 },
      { type: "Photo", date: "Saturday, Nov 22", reach: 0, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Reel", date: "Saturday, Nov 22", reach: 99, views: 93, likes: 6, comments: 0, shares: 0, interactions: 6 },
      { type: "Reel", date: "Saturday, Nov 22", reach: 118, views: 109, likes: 8, comments: 0, shares: 1, interactions: 9 },
      { type: "Reel", date: "Sunday, Nov 23", reach: 125, views: 120, likes: 4, comments: 0, shares: 0, interactions: 5 },
      { type: "Photo", date: "Sunday, Nov 23", reach: 0, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Reel", date: "Sunday, Nov 23", reach: 48, views: 41, likes: 7, comments: 0, shares: 0, interactions: 7 }
    ]
  },
  facebook: {
    name: "Facebook",
    followers: 22,
    newFollowers: 4,
    engagementRate: 54.62,
    lastWeekEngagementRate: 51.02,
    totalContent: 21,
    lastWeekTotalContent: 17,
    content: [
      { type: "Reel", date: "Monday, Nov 17", reach: 14, views: 8, likes: 6, comments: 0, shares: 0, interactions: 6, linkClicks: 0 },
      { type: "Reel", date: "Monday, Nov 17", reach: 35, views: 24, likes: 6, comments: 0, shares: 5, interactions: 11, linkClicks: 0 },
      { type: "Photo", date: "Monday, Nov 17", reach: 30, views: 17, likes: 6, comments: 0, shares: 7, interactions: 13, linkClicks: 0 },
      { type: "Photo", date: "Tuesday, Nov 18", reach: 32, views: 25, likes: 6, comments: 0, shares: 1, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Tuesday, Nov 18", reach: 75, views: 62, likes: 6, comments: 1, shares: 6, interactions: 13, linkClicks: 0 },
      { type: "Reel", date: "Tuesday, Nov 18", reach: 27, views: 15, likes: 6, comments: 0, shares: 6, interactions: 12, linkClicks: 0 },
      { type: "Photo", date: "Wednesday, Nov 19", reach: 28, views: 18, likes: 5, comments: 0, shares: 5, interactions: 10, linkClicks: 0 },
      { type: "Reel", date: "Wednesday, Nov 19", reach: 61, views: 47, likes: 5, comments: 1, shares: 8, interactions: 14, linkClicks: 0 },
      { type: "Reel", date: "Wednesday, Nov 19", reach: 14, views: 7, likes: 5, comments: 0, shares: 2, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Thursday, Nov 20", reach: 48, views: 38, likes: 5, comments: 0, shares: 5, interactions: 10, linkClicks: 0 },
      { type: "Photo", date: "Thursday, Nov 20", reach: 28, views: 20, likes: 5, comments: 0, shares: 3, interactions: 8, linkClicks: 0 },
      { type: "Photo", date: "Thursday, Nov 20", reach: 37, views: 21, likes: 5, comments: 0, shares: 11, interactions: 16, linkClicks: 0 },
      { type: "Reel", date: "Friday, Nov 21", reach: 53, views: 42, likes: 5, comments: 0, shares: 6, interactions: 11, linkClicks: 0 },
      { type: "Photo", date: "Friday, Nov 21", reach: 32, views: 15, likes: 5, comments: 0, shares: 12, interactions: 17, linkClicks: 0 },
      { type: "Reel", date: "Friday, Nov 21", reach: 3, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Photo", date: "Saturday, Nov 22", reach: 1, views: 0, likes: 0, comments: 0, shares: 1, interactions: 1, linkClicks: 0 },
      { type: "Reel", date: "Saturday, Nov 22", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Reel", date: "Saturday, Nov 22", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Reel", date: "Sunday, Nov 23", reach: 0, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Photo", date: "Sunday, Nov 23", reach: 4, views: 3, likes: 0, comments: 0, shares: 1, interactions: 1, linkClicks: 0 },
      { type: "Reel", date: "Sunday, Nov 23", reach: 4, views: 4, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
    ]
  },
  tiktok: {
    name: "TikTok",
    followers: 70,
    newFollowers: 38,
    engagementRate: 22.01,
    lastWeekEngagementRate: 21.98,
    totalContent: 12,
    lastWeekTotalContent: 7,
    content: [
      { type: "Video", date: "Monday, Nov 17", views: 106, likes: 15, comments: 1, shares: 1, interactions: 17, favorites: 4 },
      { type: "Video", date: "Tuesday, Nov 18", views: 119, likes: 4, comments: 3, shares: 0, interactions: 7, favorites: 0 },
      { type: "Video", date: "Tuesday, Nov 18", views: 24, likes: 3, comments: 2, shares: 0, interactions: 5, favorites: 1 },
      { type: "Video", date: "Wednesday, Nov 19", views: 270, likes: 33, comments: 17, shares: 13, interactions: 63, favorites: 8 },
      { type: "Video", date: "Wednesday, Nov 19", views: 250, likes: 33, comments: 13, shares: 0, interactions: 46, favorites: 3 },
      { type: "Video", date: "Wednesday, Nov 19", views: 19, likes: 6, comments: 3, shares: 0, interactions: 9, favorites: 0 },
      { type: "Video", date: "Thursday, Nov 20", views: 13, likes: 3, comments: 7, shares: 5, interactions: 15, favorites: 1 },
      { type: "Video", date: "Friday, Nov 21", views: 258, likes: 29, comments: 13, shares: 6, interactions: 48, favorites: 12 },
      { type: "Video", date: "Saturday, Nov 22", views: 17, likes: 3, comments: 0, shares: 0, interactions: 3, favorites: 0 },
      { type: "Video", date: "Sunday, Nov 23", views: 56, likes: 8, comments: 3, shares: 2, interactions: 13, favorites: 0 },
      { type: "Video", date: "Sunday, Nov 23", views: 43, likes: 1, comments: 0, shares: 0, interactions: 1, favorites: 1 },
      { type: "Video", date: "Sunday, Nov 23", views: 298, likes: 59, comments: 15, shares: 4, interactions: 78, favorites: 3 }
    ]
  },
  x: {
    name: "X",
    followers: 10,
    newFollowers: 0,
    engagementRate: 51.60,
    lastWeekEngagementRate: 49.52,
    totalContent: 14,
    lastWeekTotalContent: 10,
    content: [
      { type: "Post", date: "Monday, Nov 17", impressions: 15, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Tuesday, Nov 18", impressions: 15, engagements: 7, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 7 },
      { type: "Post", date: "Tuesday, Nov 18", impressions: 9, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Wednesday, Nov 19", impressions: 9, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Wednesday, Nov 19", impressions: 24, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Wednesday, Nov 19", impressions: 36, engagements: 7, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 7 },
      { type: "Post", date: "Thursday, Nov 20", impressions: 10, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Thursday, Nov 20", impressions: 13, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Friday, Nov 21", impressions: 20, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Friday, Nov 21", impressions: 10, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Saturday, Nov 22", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Saturday, Nov 22", impressions: 6, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Sunday, Nov 23", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Sunday, Nov 23", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 }
    ]
  }
};

// Chart Data
const chartData: ChartData[] = [
  { platform: "Instagram", followers: 44, views: 1478, interactions: 240 },
  { platform: "Facebook", followers: 22, views: 371, interactions: 157 },
  { platform: "TikTok", followers: 70, views: 1473, interactions: 305 },
  { platform: "X", followers: 10, views: 173, interactions: 70 }
];

const SerenityScrollsNov17to23 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [platformSearch, setPlatformSearch] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [activePlatform, setActivePlatform] = useState("instagram");

  // Filter top performing posts
  const filteredTopPosts = topPerformingPosts.filter(post =>
    post.link.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
    post.platform.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
    post.notes.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  // Filter platform content
  const getFilteredContent = (platform: string) => {
    const data = platformsData[platform];
    if (!data) return [];
    
    return data.content.filter(item => {
      const matchesSearch = item.date.toLowerCase().includes(platformSearch.toLowerCase()) ||
        item.type.toLowerCase().includes(platformSearch.toLowerCase());
      const matchesType = contentTypeFilter === "all" || 
        item.type.toLowerCase() === contentTypeFilter.toLowerCase();
      return matchesSearch && matchesType;
    });
  };

  // Export CSV function
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Custom tooltip for chart
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

  const getPlatformBadgeColor = (platform: string) => {
    const colors: Record<string, string> = {
      Instagram: "bg-pink-500/20 text-pink-600 border-pink-500/30",
      Facebook: "bg-blue-500/20 text-blue-600 border-blue-500/30",
      TikTok: "bg-foreground/20 text-foreground border-foreground/30",
      X: "bg-foreground/20 text-foreground border-foreground/30"
    };
    return colors[platform] || "bg-primary/20 text-primary border-primary/30";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-primary">SIENVI AGENCY</h1>
                <p className="text-sm text-muted-foreground">Client Dashboard</p>
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
        <div>
          <h2 className="text-3xl font-bold text-foreground">Serenity Scrolls</h2>
          <p className="text-muted-foreground">Weekly Performance Insights (Nov 17 - 23)</p>
        </div>

        {/* Top Performing Insights */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-xl">Top Performing Insights</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={topPostsSearch}
                    onChange={(e) => setTopPostsSearch(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(topPerformingPosts, "top-performing-posts")}>
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
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Engagement %</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Reach Tier
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="font-semibold mb-1">Reach Tier</p>
                            <p className="text-xs">Tier 1: 1M+ views<br/>Tier 2: 500K-1M<br/>Tier 3: 100K-500K<br/>Tier 4: 50K-100K<br/>Tier 5: &lt;50K</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Engagement Tier
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="font-semibold mb-1">Engagement Tier</p>
                            <p className="text-xs">Tier 1: 8%+<br/>Tier 2: 5-8%<br/>Tier 3: 3-5%<br/>Tier 4: 1-3%<br/>Tier 5: &lt;1%</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Influence
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="font-semibold mb-1">Influence (1-5)</p>
                            <p className="text-xs">Quality of interactions: mentions from authority accounts, shares by influencers, media pickups</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Conversion
                        <Tooltip>
                          <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="font-semibold mb-1">Conversion (1-5)</p>
                            <p className="text-xs">Click-throughs, DM inquiries, newsletter signups, purchases</p>
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
                        <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          View Post <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-medium">{post.views.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{post.engagement}%</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getPlatformBadgeColor(post.platform)}>
                          {post.platform}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{post.followers.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary">{post.reachTier}</Badge></TableCell>
                      <TableCell><Badge variant="secondary">{post.engagementTier}</Badge></TableCell>
                      <TableCell className="text-center">{post.influence}</TableCell>
                      <TableCell className="text-center">{post.conversion}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{post.totalScore}</TableCell>
                      <TableCell><Badge>{post.postTier}</Badge></TableCell>
                      <TableCell className="max-w-[200px] text-sm text-muted-foreground">{post.notes}</TableCell>
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
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
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
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
                <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                <TabsTrigger value="x">X</TabsTrigger>
              </TabsList>

              {Object.entries(platformsData).map(([key, platform]) => (
                <TabsContent key={key} value={key} className="space-y-6">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Followers</p>
                        <p className="text-3xl font-bold">{platform.followers.toLocaleString()}</p>
                        {platform.newFollowers > 0 && (
                          <p className="text-sm text-green-600">+{platform.newFollowers} new</p>
                        )}
                        {platform.newFollowers === 0 && (
                          <p className="text-sm text-muted-foreground">No change</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Engagement Rate</p>
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold">{platform.engagementRate}%</p>
                          {platform.engagementRate > platform.lastWeekEngagementRate ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Last week: {platform.lastWeekEngagementRate}%</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Total Content</p>
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold">{platform.totalContent}</p>
                          {platform.totalContent > platform.lastWeekTotalContent ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Last week: {platform.lastWeekTotalContent}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search content..."
                          value={platformSearch}
                          onChange={(e) => setPlatformSearch(e.target.value)}
                          className="pl-9 w-[200px]"
                        />
                      </div>
                      {(key === "instagram" || key === "facebook") && (
                        <div className="flex gap-1">
                          <Button
                            variant={contentTypeFilter === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setContentTypeFilter("all")}
                          >
                            All
                          </Button>
                          <Button
                            variant={contentTypeFilter === "reel" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setContentTypeFilter("reel")}
                          >
                            Reel
                          </Button>
                          <Button
                            variant={contentTypeFilter === "photo" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setContentTypeFilter("photo")}
                          >
                            Photo
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => exportToCSV(platform.content, `${platform.name}-content`)}>
                      <Download className="h-4 w-4 mr-2" />
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
                          {key === "instagram" && (
                            <>
                              <TableHead className="text-right">Reach</TableHead>
                              <TableHead className="text-right">Views</TableHead>
                              <TableHead className="text-right">Likes & Reactions</TableHead>
                              <TableHead className="text-right">Comments</TableHead>
                              <TableHead className="text-right">Shares</TableHead>
                              <TableHead className="text-right">Interactions</TableHead>
                            </>
                          )}
                          {key === "facebook" && (
                            <>
                              <TableHead className="text-right">Reach</TableHead>
                              <TableHead className="text-right">Views</TableHead>
                              <TableHead className="text-right">Likes & Reactions</TableHead>
                              <TableHead className="text-right">Comments</TableHead>
                              <TableHead className="text-right">Shares</TableHead>
                              <TableHead className="text-right">Interactions</TableHead>
                              <TableHead className="text-right">Link Clicks</TableHead>
                            </>
                          )}
                          {key === "tiktok" && (
                            <>
                              <TableHead className="text-right">Views</TableHead>
                              <TableHead className="text-right">Likes</TableHead>
                              <TableHead className="text-right">Comments</TableHead>
                              <TableHead className="text-right">Shares</TableHead>
                              <TableHead className="text-right">Interactions</TableHead>
                            </>
                          )}
                          {key === "x" && (
                            <>
                              <TableHead className="text-right">Impressions</TableHead>
                              <TableHead className="text-right">Engagements</TableHead>
                              <TableHead className="text-right">Profile Visits</TableHead>
                              <TableHead className="text-right">Link Clicks</TableHead>
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
                                <TableCell className="text-right">{item.reach}</TableCell>
                                <TableCell className="text-right">{item.views?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{item.likes}</TableCell>
                                <TableCell className="text-right">{item.comments}</TableCell>
                                <TableCell className="text-right">{item.shares}</TableCell>
                                <TableCell className="text-right font-medium">{item.interactions}</TableCell>
                              </>
                            )}
                            {key === "facebook" && (
                              <>
                                <TableCell className="text-right">{item.reach}</TableCell>
                                <TableCell className="text-right">{item.views?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{item.likes}</TableCell>
                                <TableCell className="text-right">{item.comments}</TableCell>
                                <TableCell className="text-right">{item.shares}</TableCell>
                                <TableCell className="text-right font-medium">{item.interactions}</TableCell>
                                <TableCell className="text-right">{item.linkClicks}</TableCell>
                              </>
                            )}
                            {key === "tiktok" && (
                              <>
                                <TableCell className="text-right">{item.views?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{item.likes}</TableCell>
                                <TableCell className="text-right">{item.comments}</TableCell>
                                <TableCell className="text-right">{item.shares}</TableCell>
                                <TableCell className="text-right font-medium">{item.interactions}</TableCell>
                              </>
                            )}
                            {key === "x" && (
                              <>
                                <TableCell className="text-right">{item.impressions}</TableCell>
                                <TableCell className="text-right">{item.engagements}</TableCell>
                                <TableCell className="text-right">{item.profileVisits}</TableCell>
                                <TableCell className="text-right">{item.linkClicks}</TableCell>
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
  );
};

export default SerenityScrollsNov17to23;