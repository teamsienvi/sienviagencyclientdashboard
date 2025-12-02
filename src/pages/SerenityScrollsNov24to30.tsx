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

// Data from CSV - Serenity Scrolls Nov 24-30
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7576714372962192654",
    views: 439,
    engagement: 30.98,
    platform: "TikTok",
    followers: 111,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 70,
    postTier: "Tier 2 (Influence)",
    notes: "Excellent engagement lifts performance"
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7578462822028381454",
    views: 290,
    engagement: 24.83,
    platform: "TikTok",
    followers: 111,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 56,
    postTier: "3 (Growth)",
    notes: "Strong audience interaction relative to view count."
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7576533730202799374",
    views: 275,
    engagement: 39.27,
    platform: "TikTok",
    followers: 111,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 55,
    postTier: "3 (Growth)",
    notes: "Very high engagement signals strong audience resonance."
  }
];

// Platform Data
const platformsData: Record<string, PlatformData> = {
  instagram: {
    name: "Instagram",
    followers: 43,
    newFollowers: 0,
    engagementRate: 21.47,
    lastWeekEngagementRate: 36.02,
    totalContent: 17,
    lastWeekTotalContent: 21,
    content: [
      { type: "Reel", date: "Monday, Nov 24", reach: 31, views: 39, likes: 5, comments: 3, shares: 0, interactions: 8 },
      { type: "Photo", date: "Monday, Nov 24", reach: "No Data", views: 8, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Reel", date: "Monday, Nov 24", reach: 65, views: 73, likes: 7, comments: 3, shares: 0, interactions: 10 },
      { type: "Reel", date: "Tuesday, Nov 25", reach: 6, views: 11, likes: 3, comments: 2, shares: 0, interactions: 5 },
      { type: "Photo", date: "Tuesday, Nov 25", reach: 1, views: 8, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Reel", date: "Wednesday, Nov 26", reach: 3, views: 8, likes: 4, comments: 3, shares: 0, interactions: 7 },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 2, views: 11, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Reel", date: "Thursday, Nov 27", reach: 17, views: 21, likes: 4, comments: 2, shares: 0, interactions: 6 },
      { type: "Photo", date: "Thursday, Nov 27", reach: 1, views: 7, likes: 3, comments: 3, shares: 0, interactions: 6 },
      { type: "Reel", date: "Friday, Nov 28", reach: 97, views: 109, likes: 17, comments: 2, shares: 0, interactions: 19 },
      { type: "Photo", date: "Friday, Nov 28", reach: 1, views: 9, likes: 2, comments: 3, shares: 0, interactions: 5 },
      { type: "Reel", date: "Saturday, Nov 29", reach: 39, views: 48, likes: 4, comments: 0, shares: 0, interactions: 4 },
      { type: "Photo", date: "Saturday, Nov 29", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Reel", date: "Saturday, Nov 29", reach: 105, views: 109, likes: 9, comments: 0, shares: 0, interactions: 9 },
      { type: "Reel", date: "Sunday, Nov 30", reach: 104, views: 115, likes: 13, comments: 0, shares: 0, interactions: 14 },
      { type: "Photo", date: "Sunday, Nov 30", reach: 2, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0 },
      { type: "Reel", date: "Sunday, Nov 30", reach: 84, views: 94, likes: 8, comments: 0, shares: 0, interactions: 9 }
    ]
  },
  facebook: {
    name: "Facebook",
    followers: 22,
    newFollowers: 0,
    engagementRate: 52.31,
    lastWeekEngagementRate: 54.62,
    totalContent: 18,
    lastWeekTotalContent: 21,
    content: [
      { type: "Reel", date: "Monday, Nov 24", reach: 8, views: 27, likes: 7, comments: 0, shares: 1, interactions: 8, linkClicks: 0 },
      { type: "Photo", date: "Monday, Nov 24", reach: 9, views: 12, likes: 7, comments: 0, shares: 1, interactions: 8, linkClicks: 0 },
      { type: "Reel", date: "Monday, Nov 24", reach: 9, views: 13, likes: 7, comments: 0, shares: 0, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Monday, Nov 24", reach: 8, views: 0, likes: 7, comments: 0, shares: 0, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Tuesday, Nov 25", reach: 9, views: 10, likes: 6, comments: 0, shares: 0, interactions: 6, linkClicks: 0 },
      { type: "Photo", date: "Tuesday, Nov 25", reach: 8, views: 18, likes: 6, comments: 0, shares: 1, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Wednesday, Nov 26", reach: 8, views: 11, likes: 6, comments: 0, shares: 0, interactions: 6, linkClicks: 0 },
      { type: "Photo", date: "Wednesday, Nov 26", reach: 8, views: 20, likes: 6, comments: 0, shares: 1, interactions: 7, linkClicks: 0 },
      { type: "Reel", date: "Thursday, Nov 27", reach: 7, views: 29, likes: 6, comments: 0, shares: 7, interactions: 13, linkClicks: 0 },
      { type: "Photo", date: "Thursday, Nov 27", reach: 7, views: 26, likes: 6, comments: 0, shares: 12, interactions: 18, linkClicks: 0 },
      { type: "Reel", date: "Friday, Nov 28", reach: 7, views: 18, likes: 5, comments: 0, shares: 3, interactions: 8, linkClicks: 0 },
      { type: "Photo", date: "Friday, Nov 28", reach: 6, views: 17, likes: 5, comments: 0, shares: 11, interactions: 16, linkClicks: 0 },
      { type: "Reel", date: "Saturday, Nov 29", reach: 7, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Photo", date: "Saturday, Nov 29", reach: 2, views: 1, likes: 0, comments: 0, shares: 1, interactions: 1, linkClicks: 0 },
      { type: "Reel", date: "Saturday, Nov 29", reach: 1, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Reel", date: "Sunday, Nov 30", reach: 2, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
      { type: "Photo", date: "Sunday, Nov 30", reach: 1, views: 1, likes: 0, comments: 0, shares: 1, interactions: 1, linkClicks: 0 },
      { type: "Reel", date: "Sunday, Nov 30", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
    ]
  },
  tiktok: {
    name: "TikTok",
    followers: 111,
    newFollowers: 41,
    engagementRate: 25.18,
    lastWeekEngagementRate: 22.01,
    totalContent: 18,
    lastWeekTotalContent: 12,
    content: [
      { type: "Video", date: "Monday, Nov 24", views: 22, likes: 0, comments: 0, shares: 0, interactions: 0, favorites: 0 },
      { type: "Video", date: "Tuesday, Nov 25", views: 439, likes: 78, comments: 37, shares: 21, interactions: 136, favorites: 17 },
      { type: "Video", date: "Tuesday, Nov 25", views: 42, likes: 4, comments: 3, shares: 6, interactions: 13, favorites: 1 },
      { type: "Video", date: "Tuesday, Nov 25", views: 36, likes: 7, comments: 0, shares: 0, interactions: 7, favorites: 0 },
      { type: "Video", date: "Tuesday, Nov 25", views: 24, likes: 2, comments: 0, shares: 0, interactions: 2, favorites: 0 },
      { type: "Video", date: "Tuesday, Nov 25", views: 275, likes: 53, comments: 30, shares: 25, interactions: 108, favorites: 10 },
      { type: "Video", date: "Wednesday, Nov 26", views: 114, likes: 0, comments: 0, shares: 0, interactions: 0, favorites: 0 },
      { type: "Video", date: "Wednesday, Nov 26", views: 121, likes: 7, comments: 2, shares: 0, interactions: 9, favorites: 0 },
      { type: "Video", date: "Thursday, Nov 27", views: 53, likes: 12, comments: 3, shares: 0, interactions: 15, favorites: 0 },
      { type: "Video", date: "Thursday, Nov 27", views: 89, likes: 0, comments: 1, shares: 0, interactions: 1, favorites: 0 },
      { type: "Video", date: "Friday, Nov 28", views: 110, likes: 1, comments: 0, shares: 0, interactions: 1, favorites: 0 },
      { type: "Video", date: "Friday, Nov 28", views: 39, likes: 8, comments: 1, shares: 0, interactions: 9, favorites: 1 },
      { type: "Video", date: "Saturday, Nov 29", views: 241, likes: 38, comments: 12, shares: 22, interactions: 72, favorites: 10 },
      { type: "Video", date: "Saturday, Nov 29", views: 27, likes: 5, comments: 4, shares: 7, interactions: 16, favorites: 4 },
      { type: "Video", date: "Saturday, Nov 29", views: 111, likes: 1, comments: 0, shares: 0, interactions: 1, favorites: 0 },
      { type: "Video", date: "Sunday, Nov 30", views: 256, likes: 37, comments: 14, shares: 22, interactions: 73, favorites: 13 },
      { type: "Video", date: "Sunday, Nov 30", views: 97, likes: 0, comments: 0, shares: 0, interactions: 0, favorites: 0 },
      { type: "Video", date: "Sunday, Nov 30", views: 290, likes: 41, comments: 15, shares: 16, interactions: 72, favorites: 7 }
    ]
  },
  x: {
    name: "X",
    followers: 10,
    newFollowers: 0,
    engagementRate: 62.00,
    lastWeekEngagementRate: 51.60,
    totalContent: 16,
    lastWeekTotalContent: 14,
    content: [
      { type: "Post", date: "Monday, Nov 24", impressions: 13, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 10, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 9, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 13, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Tuesday, Nov 25", impressions: 7, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Wednesday, Nov 26", impressions: 12, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Thursday, Nov 27", impressions: 34, engagements: 6, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 6 },
      { type: "Post", date: "Thursday, Nov 27", impressions: 12, engagements: 5, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 5 },
      { type: "Post", date: "Friday, Nov 28", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Friday, Nov 28", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Saturday, Nov 29", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Saturday, Nov 29", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Saturday, Nov 29", impressions: 8, engagements: 1, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 1 },
      { type: "Post", date: "Sunday, Nov 30", impressions: 5, engagements: 1, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 1 },
      { type: "Post", date: "Sunday, Nov 30", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 2 },
      { type: "Post", date: "Sunday, Nov 30", impressions: 12, engagements: 3, profileVisits: 0, linkClicks: 0, likes: 0, comments: 0, shares: 0, interactions: 3 }
    ]
  }
};

// Chart Data
const chartData: ChartData[] = [
  { platform: "Instagram", followers: 43, views: 676, interactions: 120 },
  { platform: "Facebook", followers: 22, views: 211, interactions: 113 },
  { platform: "TikTok", followers: 111, views: 2033, interactions: 512 },
  { platform: "X", followers: 10, views: 149, interactions: 62 }
];

const SerenityScrollsNov24to30 = () => {
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
          <p className="text-muted-foreground">Weekly Performance Insights (Nov 24 - 30)</p>
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

export default SerenityScrollsNov24to30;