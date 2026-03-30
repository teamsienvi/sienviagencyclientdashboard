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
import { Search, Download, TrendingUp, TrendingDown, ExternalLink, Info, ArrowLeft } from "lucide-react";
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

interface InstagramContent {
  type: string;
  date: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
}

interface FacebookContent {
  type: string;
  date: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
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
    link: "https://www.facebook.com/reel/1772172633482119/",
    views: 31,
    engagementPercent: 32.30,
    platform: "Facebook",
    followers: 28,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 2,
    totalScore: 42,
    postTier: "4 (Presence)",
    notes: "Low reach, High engagement"
  },
  {
    link: "https://facebook.com/reel/1424513209101954/",
    views: 30,
    engagementPercent: 33.30,
    platform: "Facebook",
    followers: 28,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 2,
    totalScore: 43,
    postTier: "4 (Presence)",
    notes: "Low reach, High engagement"
  },
  {
    link: "https://www.facebook.com/reel/1239858871301032/",
    views: 20,
    engagementPercent: 55.00,
    platform: "Facebook",
    followers: 28,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 2,
    totalScore: 46,
    postTier: "4 (Presence)",
    notes: "Low reach, High engagement"
  }
];

// Instagram Data
const instagramData: PlatformData = {
  followers: 10,
  addedFollowers: 0,
  engagementRate: 127.78,
  lastWeekEngagementRate: null,
  totalContent: 2,
  lastWeekTotalContent: null
};

const instagramContent: InstagramContent[] = [
  { type: "Reel", date: "Wed Dec 17, 8:52 AM", reach: 13, views: 22, likes: 6, comments: 0, shares: 0, interactions: 12 },
  { type: "Reel", date: "Wed Dec 17, 8:52 AM", reach: 5, views: 20, likes: 6, comments: 0, shares: 0, interactions: 11 }
];

// Facebook Data
const facebookData: PlatformData = {
  followers: 28,
  addedFollowers: 0,
  engagementRate: 44.94,
  lastWeekEngagementRate: null,
  totalContent: 7,
  lastWeekTotalContent: null
};

const facebookContent: FacebookContent[] = [
  { type: "Reel", date: "Mon Dec 15, 9:14 AM", reach: 29, views: 31, likes: 9, comments: 0, shares: 1, interactions: 10 },
  { type: "Reel", date: "Tue Dec 16, 9:16 AM", reach: 30, views: 30, likes: 8, comments: 0, shares: 2, interactions: 10 },
  { type: "Reel", date: "Wed Dec 17, 8:52 AM", reach: 13, views: 20, likes: 9, comments: 0, shares: 2, interactions: 11 },
  { type: "Reel", date: "Thu Dec 18, 10:00 AM", reach: 13, views: 18, likes: 8, comments: 0, shares: 1, interactions: 9 },
  { type: "Reel", date: "Sat Dec 20, 4:50 AM", reach: 1, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sat Dec 20, 9:52 AM", reach: 2, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sun Dec 21, 10:00 AM", reach: 1, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 }
];

// X Data
const xData: PlatformData = {
  followers: 7,
  addedFollowers: 0,
  engagementRate: 50.00,
  lastWeekEngagementRate: null,
  totalContent: 8,
  lastWeekTotalContent: null
};

const xContent: XContent[] = [
  { date: "Dec 15 2025", impressions: 9, engagement: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 15 2025", impressions: 11, engagement: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 17 2025", impressions: 10, engagement: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 17 2025", impressions: 14, engagement: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 20 2025", impressions: 2, engagement: 0, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 20 2025", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 20 2025", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 20 2025", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0 }
];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 10, views: 42, interactions: 23 },
  { platform: "Facebook", followers: 28, views: 104, interactions: 40 },
  { platform: "X", followers: 7, views: 52, interactions: 26 }
];

const SienviAgencyDec15to21 = () => {
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
    a.download = "sienvi_agency_top_posts_dec15-21.csv";
    a.click();
  };

  const TrendIndicator = ({ current, previous }: { current: number; previous: number | null }) => {
    if (previous === null) return null;
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
    previousValue?: number | null;
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

  const renderInstagramTable = () => {
    const filtered = instagramContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Reach</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Likes</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Interactions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant="default">{item.type}</Badge>
              </TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.reach}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likes}</TableCell>
              <TableCell>{item.comments}</TableCell>
              <TableCell>{item.shares}</TableCell>
              <TableCell>{item.interactions}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderFacebookTable = () => {
    const filtered = facebookContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Reach</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Likes</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Interactions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant="default">{item.type}</Badge>
              </TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.reach}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likes}</TableCell>
              <TableCell>{item.comments}</TableCell>
              <TableCell>{item.shares}</TableCell>
              <TableCell>{item.interactions}</TableCell>
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
            Sienvi Agency
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
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      </TableCell>
                      <TableCell>{post.views.toLocaleString()}</TableCell>
                      <TableCell>{post.engagementPercent}%</TableCell>
                      <TableCell>
                        <Badge variant="outline">{post.platform}</Badge>
                      </TableCell>
                      <TableCell>{post.followers}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.reachTier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.engagementTier}</Badge>
                      </TableCell>
                      <TableCell>{post.influence}</TableCell>
                      <TableCell>{post.conversion}</TableCell>
                      <TableCell className="font-semibold">{post.totalScore}</TableCell>
                      <TableCell>
                        <Badge>{post.postTier}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={post.notes}>
                        {post.notes}
                      </TableCell>
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
            <CardTitle className="text-xl font-heading">Platform Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
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
            </div>
          </CardContent>
        </Card>

        {/* Platform Content Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-heading">Platform Content Performance</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                className="pl-10 w-64"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="instagram" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
                <TabsTrigger value="x">X</TabsTrigger>
              </TabsList>
              
              <TabsContent value="instagram">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Total Followers" 
                    value={instagramData.followers} 
                    added={instagramData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${instagramData.engagementRate}%`} 
                    lastWeek={instagramData.lastWeekEngagementRate ? `${instagramData.lastWeekEngagementRate}%` : "No data"}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={instagramData.totalContent || 0} 
                    lastWeek={instagramData.lastWeekTotalContent ? `${instagramData.lastWeekTotalContent}` : "No data"}
                  />
                  <MetricCard 
                    title="Total Views" 
                    value={42} 
                  />
                </div>
                <div className="overflow-x-auto">
                  {renderInstagramTable()}
                </div>
              </TabsContent>
              
              <TabsContent value="facebook">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Total Followers" 
                    value={facebookData.followers} 
                    added={facebookData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${facebookData.engagementRate}%`} 
                    lastWeek={facebookData.lastWeekEngagementRate ? `${facebookData.lastWeekEngagementRate}%` : "No data"}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={facebookData.totalContent || 0} 
                    lastWeek={facebookData.lastWeekTotalContent ? `${facebookData.lastWeekTotalContent}` : "No data"}
                  />
                  <MetricCard 
                    title="Total Views" 
                    value={104} 
                  />
                </div>
                <div className="overflow-x-auto">
                  {renderFacebookTable()}
                </div>
              </TabsContent>
              
              <TabsContent value="x">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Total Followers" 
                    value={xData.followers} 
                    added={xData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${xData.engagementRate}%`} 
                    lastWeek={xData.lastWeekEngagementRate ? `${xData.lastWeekEngagementRate}%` : "No data"}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={xData.totalContent || 0} 
                    lastWeek={xData.lastWeekTotalContent ? `${xData.lastWeekTotalContent}` : "No data"}
                  />
                  <MetricCard 
                    title="Total Impressions" 
                    value={52} 
                  />
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

export default SienviAgencyDec15to21;
