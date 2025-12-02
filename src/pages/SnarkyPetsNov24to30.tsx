import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Download, Activity, TrendingUp, TrendingDown, Info, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";

// TypeScript interfaces
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

interface InstagramContent {
  type: string;
  date: string;
  reach: number | string;
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
  linkClicks: string;
}

interface TikTokContent {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
}

interface XContent {
  date: string;
  impressions: number;
  engagements: number;
  profileVisits: number;
  linkClicks: number;
}

interface YouTubeContent {
  date: string;
  duration: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  subscribers: number;
  impressions: number;
}

interface PlatformData {
  followers: number;
  newFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
  totalContent: number;
  lastWeekTotalContent: number;
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
    link: "https://www.youtube.com/watch?v=Z1boSSbpC8M",
    views: 1898,
    engagement: 8.01,
    platform: "YouTube",
    followers: 17,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 68,
    postTier: "3 (Growth)",
    notes: "Strong engagement; expanded reach"
  },
  {
    link: "https://www.youtube.com/watch?v=xYgKOhcozEo",
    views: 1611,
    engagement: 5.70,
    platform: "YouTube",
    followers: 17,
    reachTier: "Tier 5",
    engagementTier: "Tier 2",
    influence: 3,
    conversion: 3,
    totalScore: 60,
    postTier: "3 (Growth)",
    notes: "Minimal engagement; decent reach"
  },
  {
    link: "https://www.instagram.com/reel/DRfdJLRFWga/",
    views: 1311,
    engagement: 5.11,
    platform: "TikTok",
    followers: 2187,
    reachTier: "Tier 5",
    engagementTier: "Tier 2",
    influence: 3,
    conversion: 3,
    totalScore: 50,
    postTier: "4 (Presence)",
    notes: "Strong engagement performance for this view level"
  }
];

// Platform Data
const platformData: Record<string, PlatformData> = {
  instagram: {
    followers: 100,
    newFollowers: 3,
    engagementRate: 26.48,
    lastWeekEngagementRate: 34.63,
    totalContent: 21,
    lastWeekTotalContent: 23
  },
  facebook: {
    followers: 3143,
    newFollowers: 0,
    engagementRate: 21.82,
    lastWeekEngagementRate: 63.74,
    totalContent: 21,
    lastWeekTotalContent: 25
  },
  tiktok: {
    followers: 2190,
    newFollowers: 3,
    engagementRate: 8.94,
    lastWeekEngagementRate: 8.02,
    totalContent: 19,
    lastWeekTotalContent: 16
  },
  x: {
    followers: 20,
    newFollowers: 0,
    engagementRate: 44.09,
    lastWeekEngagementRate: 43.90,
    totalContent: 21,
    lastWeekTotalContent: 17
  },
  youtube: {
    followers: 18,
    newFollowers: 9,
    engagementRate: 9.95,
    lastWeekEngagementRate: 0,
    totalContent: 11,
    lastWeekTotalContent: 0
  }
};

// Instagram Content Data - Chronological order starting Monday
const instagramContent: InstagramContent[] = [
  { type: "Photo", date: "Monday, Nov 24", reach: 1, views: 6, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Monday, Nov 24", reach: 139, views: 147, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Monday, Nov 24", reach: 244, views: 293, likes: 12, comments: 0, shares: 0, interactions: 12 },
  { type: "Photo", date: "Tuesday, Nov 25", reach: 2, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Tuesday, Nov 25", reach: 109, views: 115, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Tuesday, Nov 25", reach: 993, views: 1300, likes: 64, comments: 1, shares: 2, interactions: 67 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 166, views: 193, likes: 5, comments: 0, shares: 1, interactions: 6 },
  { type: "Photo", date: "Wednesday, Nov 26", reach: 1, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 187, views: 216, likes: 8, comments: 1, shares: 0, interactions: 9 },
  { type: "Photo", date: "Thursday, Nov 27", reach: 2, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Thursday, Nov 27", reach: 148, views: 191, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Thursday, Nov 27", reach: 127, views: 136, likes: 2, comments: 0, shares: 0, interactions: 2 },
  { type: "Photo", date: "Friday, Nov 28", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Nov 28", reach: 175, views: 228, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Friday, Nov 28", reach: 656, views: 820, likes: 67, comments: 0, shares: 8, interactions: 80 },
  { type: "Photo", date: "Saturday, Nov 29", reach: "No Data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 112, views: 123, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 141, views: 162, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sunday, Nov 30", reach: "No Data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 128, views: 150, likes: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 116, views: 146, likes: 0, comments: 0, shares: 0, interactions: 0 }
];

// Facebook Content Data - Chronological order starting Monday
const facebookContent: FacebookContent[] = [
  { type: "Photo", date: "Monday, Nov 24", reach: 11, views: 15, likes: 2, comments: 0, shares: 0, interactions: 2, linkClicks: "no data" },
  { type: "Reel", date: "Monday, Nov 24", reach: 8, views: 10, likes: 3, comments: 0, shares: 0, interactions: 3, linkClicks: "no data" },
  { type: "Reel", date: "Monday, Nov 24", reach: 10, views: 12, likes: 3, comments: 0, shares: 0, interactions: 3, linkClicks: "no data" },
  { type: "Photo", date: "Tuesday, Nov 25", reach: 7, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Tuesday, Nov 25", reach: 8, views: 15, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Tuesday, Nov 25", reach: 11, views: 15, likes: 2, comments: 0, shares: 0, interactions: 2, linkClicks: "no data" },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 5, views: 8, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Photo", date: "Wednesday, Nov 26", reach: 11, views: 15, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 11, views: 12, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: "no data" },
  { type: "Photo", date: "Thursday, Nov 27", reach: 5, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Thursday, Nov 27", reach: 8, views: 18, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Thursday, Nov 27", reach: 7, views: 14, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Photo", date: "Friday, Nov 28", reach: 7, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Friday, Nov 28", reach: 6, views: 11, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Friday, Nov 28", reach: 7, views: 16, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Photo", date: "Saturday, Nov 29", reach: 5, views: 7, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Saturday, Nov 29", reach: 9, views: 16, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Saturday, Nov 29", reach: 115, views: 126, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: "no data" },
  { type: "Photo", date: "Sunday, Nov 30", reach: 6, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Sunday, Nov 30", reach: 18, views: 23, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" },
  { type: "Reel", date: "Sunday, Nov 30", reach: 24, views: 26, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: "no data" }
];

// TikTok Content Data - Chronological order starting Monday
const tiktokContent: TikTokContent[] = [
  { date: "Monday, Nov 24", views: 2, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Tuesday, Nov 25", views: 1, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Tuesday, Nov 25", views: 80, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Tuesday, Nov 25", views: 48, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Tuesday, Nov 25", views: 286, likes: 15, comments: 0, shares: 1, favorites: 1 },
  { date: "Wednesday, Nov 26", views: 241, likes: 17, comments: 0, shares: 0, favorites: 0 },
  { date: "Wednesday, Nov 26", views: 51, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Wednesday, Nov 26", views: 194, likes: 7, comments: 0, shares: 0, favorites: 1 },
  { date: "Thursday, Nov 27", views: 88, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Thursday, Nov 27", views: 87, likes: 1, comments: 0, shares: 0, favorites: 1 },
  { date: "Friday, Nov 28", views: 9, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Friday, Nov 28", views: 95, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Friday, Nov 28", views: 47, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "Saturday, Nov 29", views: 1, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Saturday, Nov 29", views: 861, likes: 67, comments: 0, shares: 2, favorites: 3 },
  { date: "Saturday, Nov 29", views: 127, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Sunday, Nov 30", views: 82, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Sunday, Nov 30", views: 86, likes: 0, comments: 0, shares: 0, favorites: 0 },
  { date: "Sunday, Nov 30", views: 96, likes: 2, comments: 0, shares: 0, favorites: 0 }
];

// X Content Data - Chronological order starting Monday
const xContent: XContent[] = [
  { date: "Monday, Nov 24", impressions: 10, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Monday, Nov 24", impressions: 8, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Monday, Nov 24", impressions: 9, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Tuesday, Nov 25", impressions: 11, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Tuesday, Nov 25", impressions: 17, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Tuesday, Nov 25", impressions: 15, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Wednesday, Nov 26", impressions: 18, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Wednesday, Nov 26", impressions: 9, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Wednesday, Nov 26", impressions: 11, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Thursday, Nov 27", impressions: 21, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Thursday, Nov 27", impressions: 21, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Thursday, Nov 27", impressions: 15, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { date: "Friday, Nov 28", impressions: 1, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { date: "Friday, Nov 28", impressions: 22, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Friday, Nov 28", impressions: 15, engagements: 6, profileVisits: 0, linkClicks: 0 },
  { date: "Saturday, Nov 29", impressions: 6, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Saturday, Nov 29", impressions: 24, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { date: "Saturday, Nov 29", impressions: 8, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Saturday, Nov 29", impressions: 4, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Sunday, Nov 30", impressions: 7, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Sunday, Nov 30", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 }
];

// YouTube Content Data - Chronological order starting with earliest date
const youtubeContent: YouTubeContent[] = [
  { date: "Thursday, Nov 27", duration: 8, likes: 1, comments: 0, shares: 0, views: 295, subscribers: 0, impressions: 22 },
  { date: "Friday, Nov 28", duration: 61, likes: 49, comments: 0, shares: 4, views: 1283, subscribers: 6, impressions: 27 },
  { date: "Friday, Nov 28", duration: 8, likes: 4, comments: 0, shares: 0, views: 1611, subscribers: 3, impressions: 16 },
  { date: "Saturday, Nov 29", duration: 10, likes: 8, comments: 0, shares: 0, views: 1898, subscribers: 0, impressions: 14 },
  { date: "Sunday, Nov 30", duration: 8, likes: 3, comments: 0, shares: 0, views: 454, subscribers: 0, impressions: 15 },
  { date: "Sunday, Nov 30", duration: 13, likes: 0, comments: 0, shares: 0, views: 322, subscribers: 0, impressions: 22 },
  { date: "Sunday, Nov 30", duration: 8, likes: 0, comments: 0, shares: 0, views: 258, subscribers: 0, impressions: 9 }
];

// Chart data
const chartData: ChartData[] = [
  { platform: "Instagram", followers: 100, views: 2180, interactions: 95 },
  { platform: "Facebook", followers: 3143, views: 365, interactions: 12 },
  { platform: "TikTok", followers: 2190, views: 2482, interactions: 120 },
  { platform: "X", followers: 20, views: 254, interactions: 112 },
  { platform: "YouTube", followers: 18, views: 6121, interactions: 65 }
];

const SnarkyPetsNov24to30 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [instagramSearch, setInstagramSearch] = useState("");
  const [facebookSearch, setFacebookSearch] = useState("");
  const [tiktokSearch, setTiktokSearch] = useState("");
  const [xSearch, setXSearch] = useState("");
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [instagramFilter, setInstagramFilter] = useState("All");
  const [facebookFilter, setFacebookFilter] = useState("All");

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const key = header.toLowerCase().replace(/ /g, "").replace(/&/g, "");
        const value = row[key] ?? row[header] ?? "";
        return typeof value === "string" && value.includes(",") ? `"${value}"` : value;
      }).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  const filteredTopPosts = topPerformingPosts.filter(post =>
    post.link.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
    post.platform.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  const filteredInstagram = instagramContent.filter(item =>
    (instagramFilter === "All" || item.type === instagramFilter) &&
    (item.date.toLowerCase().includes(instagramSearch.toLowerCase()) ||
    item.type.toLowerCase().includes(instagramSearch.toLowerCase()))
  );

  const filteredFacebook = facebookContent.filter(item =>
    (facebookFilter === "All" || item.type === facebookFilter) &&
    (item.date.toLowerCase().includes(facebookSearch.toLowerCase()) ||
    item.type.toLowerCase().includes(facebookSearch.toLowerCase()))
  );

  const filteredTiktok = tiktokContent.filter(item =>
    item.date.toLowerCase().includes(tiktokSearch.toLowerCase())
  );

  const filteredX = xContent.filter(item =>
    item.date.toLowerCase().includes(xSearch.toLowerCase())
  );

  const filteredYoutube = youtubeContent.filter(item =>
    item.date.toLowerCase().includes(youtubeSearch.toLowerCase())
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTrendIcon = (current: number, previous: number) => {
    if (previous === 0) return null;
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-heading font-bold text-primary">SIENVI AGENCY</h1>
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
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-heading font-bold text-foreground">Snarky Pets</h2>
            <p className="text-muted-foreground">Weekly Performance Insights (Nov 24-30)</p>
          </div>

          {/* Top Performing Insights */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-xl">Top Performing Insights</CardTitle>
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search posts..."
                      value={topPostsSearch}
                      onChange={(e) => setTopPostsSearch(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(topPerformingPosts, "top-performing-posts.csv", ["Link", "Views", "Engagement", "Platform", "Followers", "Reach Tier", "Engagement Tier", "Influence", "Conversion", "Total Score", "Post Tier", "Notes"])}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
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
                        <div className="flex items-center gap-1">
                          Reach Tier
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Tier 1: 1M+ views</p>
                              <p>Tier 2: 500K-1M</p>
                              <p>Tier 3: 100K-500K</p>
                              <p>Tier 4: 50K-100K</p>
                              <p>Tier 5: &lt;50K</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Engagement Tier
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Tier 1: 8%+</p>
                              <p>Tier 2: 5-8%</p>
                              <p>Tier 3: 3-5%</p>
                              <p>Tier 4: 1-3%</p>
                              <p>Tier 5: &lt;1%</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Influence
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Quality of interactions (mentions from authority accounts, shares by influencers, media pickups)</p>
                              <p>Scale 1-5</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Conversion
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Click-throughs, DM inquiries, newsletter signups, purchases</p>
                              <p>Scale 1-5</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
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
                          <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            View Post <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>{post.views.toLocaleString()}</TableCell>
                        <TableCell>{post.engagement}%</TableCell>
                        <TableCell><Badge variant="secondary">{post.platform}</Badge></TableCell>
                        <TableCell>{post.followers.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{post.reachTier}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{post.engagementTier}</Badge></TableCell>
                        <TableCell>{post.influence}</TableCell>
                        <TableCell>{post.conversion}</TableCell>
                        <TableCell className="font-semibold">{post.totalScore}</TableCell>
                        <TableCell><Badge>{post.postTier}</Badge></TableCell>
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
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="platform" className="text-xs" />
                    <YAxis className="text-xs" />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="followers" name="Followers" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="views" name="Total Views" fill="hsl(262, 83%, 70%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="interactions" name="Total Interactions" fill="hsl(262, 83%, 85%)" radius={[4, 4, 0, 0]} />
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
              <Tabs defaultValue="instagram" className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-6">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="x">X</TabsTrigger>
                  <TabsTrigger value="youtube">YouTube</TabsTrigger>
                </TabsList>

                {/* Instagram Tab */}
                <TabsContent value="instagram" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold">{platformData.instagram.followers.toLocaleString()}</p>
                          {platformData.instagram.newFollowers > 0 && (
                            <p className="text-sm text-green-500">+{platformData.instagram.newFollowers} new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Engagement Rate</p>
                            {renderTrendIcon(platformData.instagram.engagementRate, platformData.instagram.lastWeekEngagementRate)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.instagram.engagementRate}%</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.instagram.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Total Content</p>
                            {renderTrendIcon(platformData.instagram.totalContent, platformData.instagram.lastWeekTotalContent)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.instagram.totalContent}</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.instagram.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-2">
                      {["All", "Reel", "Photo"].map((filter) => (
                        <Button
                          key={filter}
                          variant={instagramFilter === filter ? "default" : "outline"}
                          size="sm"
                          onClick={() => setInstagramFilter(filter)}
                        >
                          {filter}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={instagramSearch}
                          onChange={(e) => setInstagramSearch(e.target.value)}
                          className="pl-9 w-full sm:w-64"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToCSV(instagramContent, "instagram-content.csv", ["Type", "Date", "Reach", "Views", "Likes", "Comments", "Shares", "Interactions"])}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Reach</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Likes & Reactions</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Interactions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInstagram.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant={item.type === "Reel" ? "default" : "secondary"}>{item.type}</Badge>
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
                  </div>
                </TabsContent>

                {/* Facebook Tab */}
                <TabsContent value="facebook" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold">{platformData.facebook.followers.toLocaleString()}</p>
                          {platformData.facebook.newFollowers > 0 && (
                            <p className="text-sm text-green-500">+{platformData.facebook.newFollowers} new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Engagement Rate</p>
                            {renderTrendIcon(platformData.facebook.engagementRate, platformData.facebook.lastWeekEngagementRate)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.facebook.engagementRate}%</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.facebook.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Total Content</p>
                            {renderTrendIcon(platformData.facebook.totalContent, platformData.facebook.lastWeekTotalContent)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.facebook.totalContent}</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.facebook.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-2">
                      {["All", "Reel", "Photo"].map((filter) => (
                        <Button
                          key={filter}
                          variant={facebookFilter === filter ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFacebookFilter(filter)}
                        >
                          {filter}
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={facebookSearch}
                          onChange={(e) => setFacebookSearch(e.target.value)}
                          className="pl-9 w-full sm:w-64"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportToCSV(facebookContent, "facebook-content.csv", ["Type", "Date", "Reach", "Views", "Likes", "Comments", "Shares", "Interactions", "Link Clicks"])}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Reach</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Likes & Reactions</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Interactions</TableHead>
                          <TableHead>Link Clicks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFacebook.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant={item.type === "Reel" ? "default" : "secondary"}>{item.type}</Badge>
                            </TableCell>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.reach}</TableCell>
                            <TableCell>{item.views}</TableCell>
                            <TableCell>{item.likes}</TableCell>
                            <TableCell>{item.comments}</TableCell>
                            <TableCell>{item.shares}</TableCell>
                            <TableCell>{item.interactions}</TableCell>
                            <TableCell>{item.linkClicks}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* TikTok Tab */}
                <TabsContent value="tiktok" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold">{platformData.tiktok.followers.toLocaleString()}</p>
                          {platformData.tiktok.newFollowers > 0 && (
                            <p className="text-sm text-green-500">+{platformData.tiktok.newFollowers} new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Engagement Rate</p>
                            {renderTrendIcon(platformData.tiktok.engagementRate, platformData.tiktok.lastWeekEngagementRate)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.tiktok.engagementRate}%</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.tiktok.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Total Content</p>
                            {renderTrendIcon(platformData.tiktok.totalContent, platformData.tiktok.lastWeekTotalContent)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.tiktok.totalContent}</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.tiktok.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={tiktokSearch}
                        onChange={(e) => setTiktokSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(tiktokContent, "tiktok-content.csv", ["Date", "Views", "Likes", "Comments", "Shares", "Favorites"])}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Likes</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Add to Favorites</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTiktok.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.views.toLocaleString()}</TableCell>
                            <TableCell>{item.likes}</TableCell>
                            <TableCell>{item.comments}</TableCell>
                            <TableCell>{item.shares}</TableCell>
                            <TableCell>{item.favorites}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* X Tab */}
                <TabsContent value="x" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold">{platformData.x.followers.toLocaleString()}</p>
                          {platformData.x.newFollowers > 0 && (
                            <p className="text-sm text-green-500">+{platformData.x.newFollowers} new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Engagement Rate</p>
                            {renderTrendIcon(platformData.x.engagementRate, platformData.x.lastWeekEngagementRate)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.x.engagementRate}%</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.x.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Total Content</p>
                            {renderTrendIcon(platformData.x.totalContent, platformData.x.lastWeekTotalContent)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.x.totalContent}</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.x.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={xSearch}
                        onChange={(e) => setXSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(xContent, "x-content.csv", ["Date", "Impressions", "Engagements", "Profile Visits", "Link Clicks"])}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Impressions</TableHead>
                          <TableHead>Engagements</TableHead>
                          <TableHead>Profile Visits</TableHead>
                          <TableHead>Link Clicks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredX.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.impressions}</TableCell>
                            <TableCell>{item.engagements}</TableCell>
                            <TableCell>{item.profileVisits}</TableCell>
                            <TableCell>{item.linkClicks}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* YouTube Tab */}
                <TabsContent value="youtube" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Subscribers</p>
                          <p className="text-3xl font-bold">{platformData.youtube.followers}</p>
                          {platformData.youtube.newFollowers > 0 && (
                            <p className="text-sm text-green-500">+{platformData.youtube.newFollowers} new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Engagement Rate</p>
                            {platformData.youtube.lastWeekEngagementRate > 0 && renderTrendIcon(platformData.youtube.engagementRate, platformData.youtube.lastWeekEngagementRate)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.youtube.engagementRate}%</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.youtube.lastWeekEngagementRate > 0 ? `${platformData.youtube.lastWeekEngagementRate}%` : "-"}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-sm text-muted-foreground">Total Content</p>
                            {platformData.youtube.lastWeekTotalContent > 0 && renderTrendIcon(platformData.youtube.totalContent, platformData.youtube.lastWeekTotalContent)}
                          </div>
                          <p className="text-3xl font-bold">{platformData.youtube.totalContent}</p>
                          <p className="text-sm text-muted-foreground">Last week: {platformData.youtube.lastWeekTotalContent > 0 ? platformData.youtube.lastWeekTotalContent : "-"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        value={youtubeSearch}
                        onChange={(e) => setYoutubeSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportToCSV(youtubeContent, "youtube-content.csv", ["Date", "Duration", "Likes", "Comments", "Shares", "Views", "Subscribers", "Impressions"])}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Duration (s)</TableHead>
                          <TableHead>Likes</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Subscribers</TableHead>
                          <TableHead>Impressions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredYoutube.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.duration}</TableCell>
                            <TableCell>{item.likes}</TableCell>
                            <TableCell>{item.comments}</TableCell>
                            <TableCell>{item.shares}</TableCell>
                            <TableCell>{item.views.toLocaleString()}</TableCell>
                            <TableCell>{item.subscribers}</TableCell>
                            <TableCell>{item.impressions}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default SnarkyPetsNov24to30;
