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
    link: "https://www.youtube.com/shorts/dnJkx3aYXos",
    views: 992,
    engagementPercent: 1.20,
    platform: "YouTube",
    followers: 5,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 2,
    conversion: 1,
    totalScore: 45,
    postTier: "4 (Presence)",
    notes: "Strong visual appeal drove near-1K reach, but very low interaction limits overall impact."
  },
  {
    link: "https://www.youtube.com/shorts/4X9ioR5xHZM",
    views: 823,
    engagementPercent: 1.12,
    platform: "YouTube",
    followers: 5,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 2,
    conversion: 1,
    totalScore: 44,
    postTier: "4 (Presence)",
    notes: "Decent reach but limited interaction"
  },
  {
    link: "https://www.facebook.com/reel/848559274768125/",
    views: 211,
    engagementPercent: 8.10,
    platform: "Facebook",
    followers: 77,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 2,
    totalScore: 66,
    postTier: "3 (Growth)",
    notes: "Exceptional engagement density"
  }
];

// Instagram Data
const instagramData: PlatformData = {
  followers: 32,
  addedFollowers: 1,
  engagementRate: 53.20,
  lastWeekEngagementRate: 51.32,
  totalContent: 13,
  lastWeekTotalContent: 11
};

// Facebook Data
const facebookData: PlatformData = {
  followers: 77,
  addedFollowers: 2,
  engagementRate: 50.00,
  lastWeekEngagementRate: 48.15,
  totalContent: 14,
  lastWeekTotalContent: 12
};

// TikTok Data
const tiktokData: PlatformData = {
  followers: 6,
  addedFollowers: 0,
  engagementRate: 9.84,
  lastWeekEngagementRate: 7.31,
  totalContent: 15,
  lastWeekTotalContent: 13
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "December 15, 2025", views: 92, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 15, 2025", views: 91, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 09, 2025", views: 95, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 16, 2025", views: 90, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 16, 2025", views: 100, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 17, 2025", views: 87, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 17, 2025", views: 95, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 18, 2025", views: 100, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 18, 2025", views: 87, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 19, 2025", views: 88, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 20, 2025", views: 84, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 20, 2025", views: 88, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 20, 2025", views: 93, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 21, 2025", views: 97, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "December 21, 2025", views: 89, likes: 2, comments: 0, shares: 0, addToFavorites: 0 }
];

// X Data
const xData: PlatformData = {
  followers: 9,
  addedFollowers: 0,
  engagementRate: 69.77,
  lastWeekEngagementRate: 76.62,
  totalContent: 9,
  lastWeekTotalContent: 11
};

const xContent: XContent[] = [
  { date: "December 17, 2025", impressions: 7, engagement: 6, profileVisits: 0, linkClicks: 0 },
  { date: "December 17, 2025", impressions: 9, engagement: 6, profileVisits: 0, linkClicks: 0 },
  { date: "December 18, 2025", impressions: 3, engagement: 4, profileVisits: 0, linkClicks: 0 },
  { date: "December 18, 2025", impressions: 10, engagement: 4, profileVisits: 0, linkClicks: 0 },
  { date: "December 20, 2025", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 20, 2025", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 20, 2025", impressions: 5, engagement: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 20, 2025", impressions: 3, engagement: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 21, 2025", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0 }
];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 32, views: 428, interactions: 24 },
  { platform: "Facebook", followers: 77, views: 506, interactions: 68 },
  { platform: "TikTok", followers: 6, views: 1376, interactions: 30 },
  { platform: "X", followers: 9, views: 43, interactions: 30 }
];

const TheHavenAtDeerParkDec15to21 = () => {
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
    a.download = "the_haven_at_deer_park_top_posts_dec15-21.csv";
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
            The Haven at Deer Park
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

export default TheHavenAtDeerParkDec15to21;
