import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity, Search, Download, TrendingUp, TrendingDown, ExternalLink, Info, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

// TypeScript Interfaces
interface TopPerformingPost {
  link: string;
  views: number;
  engagementPercent: number;
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

interface TikTokContent {
  type: string;
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  addToFavorites: number;
}

interface XContent {
  date: string;
  impressions: number;
  engagement: number;
  profileVisits: number;
  linkClicks: number;
}

interface PlatformData {
  followers: number;
  addedFollowers: number;
  engagementRate: number | null;
  lastWeekEngagementRate: number | null;
  totalContent: number | null;
  lastWeekTotalContent: number | null;
}

// Data from CSV - Dec 15-21
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7584513030432623886",
    views: 338,
    engagementPercent: 10.70,
    platform: "TikTok",
    followers: 262,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 5,
    conversion: 5,
    totalScore: 58,
    postTier: "3 (Growth)",
    notes: "Excellent engagement density for its size; strong audience resonance despite modest reach."
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7584513066029632781",
    views: 335,
    engagementPercent: 19.40,
    platform: "TikTok",
    followers: 262,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 61,
    postTier: "3 (Growth)",
    notes: "Standout engagement efficiency—this format clearly triggers interaction and should be scaled."
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7584161701583424781",
    views: 330,
    engagementPercent: 46.70,
    platform: "TikTok",
    followers: 262,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 70,
    postTier: "Tier 2 (Influence)",
    notes: "Exceptional interaction and saves signal high intent; this is a breakout post relative to reach."
  }
];

// Instagram Data
const instagramData: PlatformData = {
  followers: 49,
  addedFollowers: 1,
  engagementRate: null,
  lastWeekEngagementRate: 19.64,
  totalContent: 21,
  lastWeekTotalContent: 19
};

// Facebook Data
const facebookData: PlatformData = {
  followers: 26,
  addedFollowers: 1,
  engagementRate: 59.21,
  lastWeekEngagementRate: 56.00,
  totalContent: 21,
  lastWeekTotalContent: 20
};

// TikTok Data
const tiktokData: PlatformData = {
  followers: 262,
  addedFollowers: 35,
  engagementRate: 19.61,
  lastWeekEngagementRate: 27.11,
  totalContent: null,
  lastWeekTotalContent: 17
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "Sunday, Dec 21", views: 233, likes: 22, comments: 3, shares: 0, addToFavorites: 4 },
  { type: "Video", date: "Sunday, Dec 21", views: 180, likes: 24, comments: 6, shares: 0, addToFavorites: 7 },
  { type: "Video", date: "Sunday, Dec 21", views: 180, likes: 3, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 21", views: 280, likes: 50, comments: 9, shares: 0, addToFavorites: 8 },
  { type: "Video", date: "Sunday, Dec 21", views: 115, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 20", views: 195, likes: 19, comments: 8, shares: 0, addToFavorites: 3 },
  { type: "Video", date: "Saturday, Dec 20", views: 130, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 20", views: 269, likes: 53, comments: 23, shares: 34, addToFavorites: 19 },
  { type: "Video", date: "Saturday, Dec 20", views: 111, likes: 10, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Thursday, Dec 18", views: 317, likes: 34, comments: 3, shares: 4, addToFavorites: 5 },
  { type: "Video", date: "Thursday, Dec 18", views: 110, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 18", views: 216, likes: 18, comments: 1, shares: 7, addToFavorites: 3 },
  { type: "Video", date: "Wednesday, Dec 17", views: 202, likes: 19, comments: 1, shares: 0, addToFavorites: 3 },
  { type: "Video", date: "Wednesday, Dec 17", views: 319, likes: 37, comments: 6, shares: 15, addToFavorites: 4 },
  { type: "Video", date: "Wednesday, Dec 17", views: 118, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 16", views: 89, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 16", views: 335, likes: 44, comments: 9, shares: 8, addToFavorites: 4 },
  { type: "Video", date: "Tuesday, Dec 16", views: 338, likes: 32, comments: 2, shares: 0, addToFavorites: 2 },
  { type: "Video", date: "Monday, Dec 15", views: 330, likes: 91, comments: 43, shares: 4, addToFavorites: 16 },
  { type: "Video", date: "Monday, Dec 15", views: 198, likes: 19, comments: 7, shares: 1, addToFavorites: 2 },
  { type: "Video", date: "Monday, Dec 15", views: 96, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Monday, Dec 15", views: 210, likes: 41, comments: 7, shares: 0, addToFavorites: 6 }
];

// X Data
const xData: PlatformData = {
  followers: 10,
  addedFollowers: 0,
  engagementRate: null,
  lastWeekEngagementRate: 54.00,
  totalContent: null,
  lastWeekTotalContent: 16
};

const xContent: XContent[] = [];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 49, views: 759, interactions: 76 },
  { platform: "Facebook", followers: 26, views: 137, interactions: 90 },
  { platform: "TikTok", followers: 262, views: 3258, interactions: 639 },
  { platform: "X", followers: 10, views: 0, interactions: 0 }
];

const SerenityScrollsDec15to21 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");

  const filteredTopPosts = topPerformingPosts.filter(post =>
    post.platform.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
    post.notes.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  const exportTopPostsCSV = () => {
    const headers = ["Link", "Views", "Engagement %", "Platform", "Followers", "Reach Tier", "Engagement Tier", "Influence", "Conversion", "Total Score", "Post Tier", "Notes"];
    const rows = topPerformingPosts.map(post => [
      post.link, post.views, post.engagementPercent, post.platform, post.followers,
      post.reachTier, post.engagementTier, post.influence, post.conversion,
      post.totalScore, post.postTier, post.notes
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "serenity_scrolls_top_posts_dec15-21.csv";
    a.click();
  };

  const TrendIndicator = ({ current, previous }: { current: number; previous: number }) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const MetricCard = ({ 
    title, 
    value, 
    added, 
    lastWeek, 
    showTrend = false,
    currentValue,
    previousValue 
  }: { 
    title: string; 
    value: string | number; 
    added?: number; 
    lastWeek?: string;
    showTrend?: boolean;
    currentValue?: number;
    previousValue?: number;
  }) => (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-heading font-bold text-foreground">{value}</span>
          {added !== undefined && added > 0 && (
            <span className="text-sm text-green-500 font-medium">+{added}</span>
          )}
          {showTrend && currentValue !== undefined && previousValue !== undefined && (
            <TrendIndicator current={currentValue} previous={previousValue} />
          )}
        </div>
        {lastWeek && (
          <p className="text-xs text-muted-foreground mt-1">Last week: {lastWeek}</p>
        )}
      </CardContent>
    </Card>
  );

  const renderTikTokTable = () => {
    const filtered = tiktokContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Likes</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Add to Favorites</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant="default">{item.type}</Badge>
              </TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likes}</TableCell>
              <TableCell>{item.comments}</TableCell>
              <TableCell>{item.shares}</TableCell>
              <TableCell>{item.addToFavorites}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderXTable = () => {
    if (xContent.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No X content data available for this period
        </div>
      );
    }

    const filtered = xContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Impressions</TableHead>
            <TableHead>Engagement</TableHead>
            <TableHead>Profile Visits</TableHead>
            <TableHead>Link Clicks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.impressions.toLocaleString()}</TableCell>
              <TableCell>{item.engagement}</TableCell>
              <TableCell>{item.profileVisits}</TableCell>
              <TableCell>{item.linkClicks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold text-foreground mb-2">
            Serenity Scrolls
          </h1>
          <p className="text-muted-foreground text-lg">
            Weekly Performance Insights: December 15-21, 2025
          </p>
        </div>

        {/* Top Performing Insights */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-heading">Top Performing Insights</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm">
                      <strong>Reach Tiers:</strong> Tier 1: 1M+, Tier 2: 500K-1M, Tier 3: 100K-500K, Tier 4: 50K-100K, Tier 5: &lt;50K<br/>
                      <strong>Engagement Tiers:</strong> Tier 1: 8%+, Tier 2: 5-8%, Tier 3: 3-5%, Tier 4: 1-3%, Tier 5: &lt;1%
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  className="pl-10 w-64"
                  value={topPostsSearch}
                  onChange={(e) => setTopPostsSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportTopPostsCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Engagement %</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>Reach Tier</TableHead>
                    <TableHead>Engagement Tier</TableHead>
                    <TableHead>Influence</TableHead>
                    <TableHead>Conversion</TableHead>
                    <TableHead>Total Score</TableHead>
                    <TableHead>Post Tier</TableHead>
                    <TableHead className="max-w-xs">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPosts.map((post, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <a 
                          href={post.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </a>
                      </TableCell>
                      <TableCell>{post.views.toLocaleString()}</TableCell>
                      <TableCell>{post.engagementPercent}%</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.platform}</Badge>
                      </TableCell>
                      <TableCell>{post.followers.toLocaleString()}</TableCell>
                      <TableCell>{post.reachTier}</TableCell>
                      <TableCell>{post.engagementTier}</TableCell>
                      <TableCell>{post.influence}</TableCell>
                      <TableCell>{post.conversion}</TableCell>
                      <TableCell className="font-bold">{post.totalScore}</TableCell>
                      <TableCell>{post.postTier}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">{post.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Platform Performance Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-heading flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Platform Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="platform" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="followers" fill="hsl(var(--primary))" name="Followers" />
                <Bar dataKey="views" fill="hsl(var(--chart-2))" name="Views" />
                <Bar dataKey="interactions" fill="hsl(var(--chart-3))" name="Interactions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Content Performance - TikTok and X */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-heading">Platform Content Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tiktok" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                <TabsTrigger value="x">X</TabsTrigger>
              </TabsList>

              {/* TikTok Tab */}
              <TabsContent value="tiktok">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCard 
                    title="Followers" 
                    value={tiktokData.followers.toLocaleString()} 
                    added={tiktokData.addedFollowers}
                  />
                  <MetricCard 
                    title="Engagement Rate %" 
                    value={tiktokData.engagementRate !== null ? `${tiktokData.engagementRate}%` : "N/A"}
                    showTrend
                    currentValue={tiktokData.engagementRate ?? 0}
                    previousValue={tiktokData.lastWeekEngagementRate ?? 0}
                    lastWeek={tiktokData.lastWeekEngagementRate !== null ? `${tiktokData.lastWeekEngagementRate}%` : undefined}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={tiktokData.totalContent ?? "N/A"}
                    showTrend
                    currentValue={tiktokData.totalContent ?? 0}
                    previousValue={tiktokData.lastWeekTotalContent ?? 0}
                    lastWeek={tiktokData.lastWeekTotalContent !== null ? `${tiktokData.lastWeekTotalContent}` : undefined}
                  />
                </div>
                
                <div className="mb-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search content..."
                      className="pl-10"
                      value={contentSearch}
                      onChange={(e) => setContentSearch(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  {renderTikTokTable()}
                </div>
              </TabsContent>

              {/* X Tab */}
              <TabsContent value="x">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCard 
                    title="Followers" 
                    value={xData.followers.toLocaleString()} 
                    added={xData.addedFollowers}
                  />
                  <MetricCard 
                    title="Engagement Rate %" 
                    value={xData.engagementRate !== null ? `${xData.engagementRate}%` : "N/A"}
                    showTrend
                    currentValue={xData.engagementRate ?? 0}
                    previousValue={xData.lastWeekEngagementRate ?? 0}
                    lastWeek={xData.lastWeekEngagementRate !== null ? `${xData.lastWeekEngagementRate}%` : undefined}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={xData.totalContent ?? "N/A"}
                    showTrend
                    currentValue={xData.totalContent ?? 0}
                    previousValue={xData.lastWeekTotalContent ?? 0}
                    lastWeek={xData.lastWeekTotalContent !== null ? `${xData.lastWeekTotalContent}` : undefined}
                  />
                </div>
                
                <div className="mb-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search content..."
                      className="pl-10"
                      value={contentSearch}
                      onChange={(e) => setContentSearch(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  {renderXTable()}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SerenityScrollsDec15to21;
