import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, TrendingUp, TrendingDown, Download, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/Header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TopPerformingPost {
  link: string;
  views: string;
  engagementPercent: string;
  page: string;
  followers: number;
  reachTier: string;
  engagementTier: string;
  influence: number;
  conversionSignals: number;
  totalScore: number;
  postTier: string;
  notes: string;
}

interface InstagramContent {
  type: string;
  date: string;
  reach: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
}

interface FacebookContent {
  type: string;
  date: string;
  reach: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  interactions: number;
  linkClicks: number;
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

const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.youtube.com/shorts/d9dynMYoX98",
    views: "1,037",
    engagementPercent: "4.19%",
    page: "Youtube",
    followers: 6,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 1,
    conversionSignals: 1,
    totalScore: 44,
    postTier: "4 (Presence)",
    notes: "High visibility but minimal interaction",
  },
  {
    link: "https://www.youtube.com/shorts/31Rf6MhG8Jc",
    views: "163",
    engagementPercent: "2.12%",
    page: "Youtube",
    followers: 6,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 1,
    conversionSignals: 1,
    totalScore: 40,
    postTier: "4 (Presence)",
    notes: "low engagement;",
  },
  {
    link: "https://www.tiktok.com/@oxisuretech/video/7580806408036191499",
    views: "101",
    engagementPercent: "1.99%",
    page: "Tiktok",
    followers: 6,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 1,
    conversionSignals: 1,
    totalScore: 38,
    postTier: "4 (Presence)",
    notes: "low engagement;",
  },
];

const instagramData = {
  oldFollowers: 9,
  addedFollowers: 1,
  totalFollowers: 10,
  engagementRate: "No data",
  lastWeekEngagementRate: "No data",
  totalContent: 11,
  lastWeekTotalContent: 12,
};

const instagramContent: InstagramContent[] = [
  { type: "Photo", date: "Mon Dec 1, 10:00 AM", reach: "No data", views: 5, likes: 4, comments: 4, shares: 0, interactions: 8 },
  { type: "Photo", date: "Wed Dec 3, 10:03 AM", reach: "No data", views: 5, likes: 4, comments: 4, shares: 0, interactions: 8 },
  { type: "Photo", date: "Wed Dec 3, 1:27 PM", reach: "2", views: 7, likes: 4, comments: 5, shares: 0, interactions: 9 },
  { type: "Photo", date: "Thu Dec 4, 9:55 PM", reach: "No data", views: 1, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Fri Dec 5, 8:40 PM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sat Dec 6, 8:43 AM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sat Dec 6, 10:00 AM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sat Dec 6, 1:48 PM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sun Dec 7, 8:45 AM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sun Dec 7, 10:00 AM", reach: "1", views: 3, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sun Dec 7, 3:50 PM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
];

const facebookData = {
  oldFollowers: 23,
  addedFollowers: 2,
  totalFollowers: 25,
  engagementRate: "97.01",
  lastWeekEngagementRate: "No data",
  totalContent: 13,
  lastWeekTotalContent: 13,
};

const facebookContent: FacebookContent[] = [
  { type: "Photo", date: "Mon Dec 1, 10:00 AM", reach: "12", views: 17, likes: 8, comments: 0, shares: 0, interactions: 8, linkClicks: 0 },
  { type: "Photo", date: "Tue Dec 2, 9:40 AM", reach: "11", views: 23, likes: 8, comments: 0, shares: 1, interactions: 9, linkClicks: 0 },
  { type: "Photo", date: "Tue Dec 2, 11:42 AM", reach: "11", views: 26, likes: 8, comments: 0, shares: 1, interactions: 9, linkClicks: 0 },
  { type: "Photo", date: "Wed Dec 3, 10:03 AM", reach: "9", views: 22, likes: 6, comments: 0, shares: 5, interactions: 11, linkClicks: 0 },
  { type: "Photo", date: "Wed Dec 3, 1:27 PM", reach: "8", views: 21, likes: 5, comments: 0, shares: 10, interactions: 15, linkClicks: 0 },
  { type: "Photo", date: "Thu Dec 4, 9:55 PM", reach: "8", views: 15, likes: 5, comments: 0, shares: 8, interactions: 13, linkClicks: 0 },
  { type: "Reel", date: "Fri Dec 5, 8:40 PM", reach: "No data", views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sat Dec 6, 8:43 AM", reach: "No data", views: 0, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sat Dec 6, 10:00 AM", reach: "1", views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sat Dec 6, 1:48 PM", reach: "2", views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sun Dec 7, 8:44 AM", reach: "2", views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sun Dec 7, 10:00 AM", reach: "1", views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sun Dec 7, 3:49 PM", reach: "2", views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
];

const tiktokData = {
  oldFollowers: 6,
  addedFollowers: "-",
  totalFollowers: 6,
  engagementRate: "30.14",
  lastWeekEngagementRate: "29.20",
  totalContent: 13,
  lastWeekTotalContent: 12,
};

const tiktokContent: TikTokContent[] = [
  { date: "December 01, 2025", views: 91, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 02, 2025", views: 100, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 02, 2025", views: 101, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 03, 2025", views: 93, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 03, 2025", views: 97, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 04, 2025", views: 99, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 04, 2025", views: 89, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 05, 2025", views: 93, likes: 3, comments: 0, shares: 0, favorites: 0 },
  { date: "December 05, 2025", views: 92, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 06, 2025", views: 94, likes: 3, comments: 0, shares: 0, favorites: 0 },
  { date: "December 06, 2025", views: 100, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 07, 2025", views: 88, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 07, 2025", views: 91, likes: 2, comments: 0, shares: 0, favorites: 0 },
];

const xData = {
  oldFollowers: 10,
  addedFollowers: "-",
  totalFollowers: 10,
  engagementRate: "85.93",
  lastWeekEngagementRate: "80.00",
  totalContent: 16,
  lastWeekTotalContent: 17,
};

const xContent: XContent[] = [
  { date: "December 01, 2025", impressions: 7, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 02, 2025", impressions: 12, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 02, 2025", impressions: 6, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 03, 2025", impressions: 8, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 03, 2025", impressions: 10, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 03, 2025", impressions: 24, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 04, 2025", impressions: 17, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 04, 2025", impressions: 10, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "December 05, 2025", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 05, 2025", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 06, 2025", impressions: 6, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 06, 2025", impressions: 1, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { date: "December 06, 2025", impressions: 16, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { date: "December 07, 2025", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 07, 2025", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "December 07, 2025", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0 },
];

const youtubeData = {
  oldFollowers: 5,
  addedFollowers: "-",
  totalFollowers: 5,
  engagementRate: "13.31",
  lastWeekEngagementRate: "-",
  totalContent: 12,
  lastWeekTotalContent: "-",
};

const youtubeContent: YouTubeContent[] = [
  { date: "Dec 1, 2025", duration: 81, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 4 },
  { date: "Dec 2, 2025", duration: 30, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 2 },
  { date: "Dec 3, 2025", duration: 30, likes: 0, comments: 0, shares: 0, views: 117, subscribers: 0, impressions: 8 },
  { date: "Dec 3, 2025", duration: 58, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0, impressions: 2 },
  { date: "Dec 4, 2025", duration: 28, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 5 },
  { date: "Dec 5, 2025", duration: 41, likes: 0, comments: 0, shares: 0, views: 163, subscribers: 0, impressions: 9 },
  { date: "Dec 5, 2025", duration: 58, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 8 },
  { date: "Dec 6, 2025", duration: 28, likes: 0, comments: 0, shares: 0, views: 3, subscribers: 0, impressions: 26 },
  { date: "Dec 6, 2025", duration: 43, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 2 },
  { date: "Dec 6, 2025", duration: 41, likes: 1, comments: 0, shares: 0, views: 1037, subscribers: 0, impressions: 104 },
  { date: "Dec 7, 2025", duration: 34, likes: 0, comments: 0, shares: 0, views: 39, subscribers: 0, impressions: 8 },
  { date: "Dec 7, 2025", duration: 81, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 2 },
];

const chartData = [
  {
    name: "Instagram",
    followers: instagramData.totalFollowers,
    views: 21,
    interactions: 25,
  },
  {
    name: "Facebook",
    followers: facebookData.totalFollowers,
    views: 132,
    interactions: 65,
  },
  {
    name: "TikTok",
    followers: tiktokData.totalFollowers,
    views: 581,
    interactions: 12,
  },
  {
    name: "X",
    followers: xData.totalFollowers,
    views: 135,
    interactions: 58,
  },
  {
    name: "YouTube",
    followers: youtubeData.totalFollowers,
    views: 1360,
    interactions: 1,
  },
];

const reachTierTooltip = `Tier 1: 1M+ views
Tier 2: 500K – 1M
Tier 3: 100K – 500K
Tier 4: 50K – 100K
Tier 5: <50K`;

const engagementTierTooltip = `Tier 1: 8%+ engagement rate
Tier 2: 5–8%
Tier 3: 3–5%
Tier 4: 1–3%
Tier 5: <1%`;

const OxiSureTechDec1to7 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [instagramSearch, setInstagramSearch] = useState("");
  const [facebookSearch, setFacebookSearch] = useState("");
  const [tiktokSearch, setTiktokSearch] = useState("");
  const [xSearch, setXSearch] = useState("");
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [instagramFilter, setInstagramFilter] = useState("all");
  const [facebookFilter, setFacebookFilter] = useState("all");

  const filteredTopPosts = topPerformingPosts.filter(
    (post) =>
      post.page.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
      post.notes.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  const filteredInstagramContent = instagramContent.filter((content) => {
    const matchesSearch = content.date.toLowerCase().includes(instagramSearch.toLowerCase());
    const matchesFilter = instagramFilter === "all" || content.type.toLowerCase() === instagramFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredFacebookContent = facebookContent.filter((content) => {
    const matchesSearch = content.date.toLowerCase().includes(facebookSearch.toLowerCase());
    const matchesFilter = facebookFilter === "all" || content.type.toLowerCase() === facebookFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredTiktokContent = tiktokContent.filter((content) =>
    content.date.toLowerCase().includes(tiktokSearch.toLowerCase())
  );

  const filteredXContent = xContent.filter((content) =>
    content.date.toLowerCase().includes(xSearch.toLowerCase())
  );

  const filteredYoutubeContent = youtubeContent.filter((content) =>
    content.date.toLowerCase().includes(youtubeSearch.toLowerCase())
  );

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

  const getTrendIndicator = (current: string, previous: string) => {
    if (current === "No data" || previous === "No data" || current === "-" || previous === "-") return null;
    const currentNum = parseFloat(current);
    const previousNum = parseFloat(previous);
    if (currentNum > previousNum) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (currentNum < previousNum) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-primary hover:text-primary/80 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Clients
          </Link>
          <h1 className="text-3xl font-bold text-foreground">OxiSure Tech</h1>
          <p className="text-muted-foreground">Weekly Performance Report: Dec 1-7, 2025</p>
        </div>

        {/* Top Performing Posts */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl">Top Performing Insights</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={topPostsSearch}
                    onChange={(e) => setTopPostsSearch(e.target.value)}
                    className="pl-10 w-[200px]"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCSV(topPerformingPosts, "top-posts.csv")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
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
                    <TableHead>Page</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Reach Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs whitespace-pre-line">
                            {reachTierTooltip}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Engagement Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs whitespace-pre-line">
                            {engagementTierTooltip}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>Total Score</TableHead>
                    <TableHead>Post Tier</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPosts.map((post, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <a
                          href={post.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline truncate max-w-[200px] block"
                        >
                          {post.link.substring(0, 40)}...
                        </a>
                      </TableCell>
                      <TableCell>{post.views}</TableCell>
                      <TableCell>{post.engagementPercent}</TableCell>
                      <TableCell>{post.page}</TableCell>
                      <TableCell>{post.followers}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.reachTier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{post.engagementTier}</Badge>
                      </TableCell>
                      <TableCell>{post.totalScore}</TableCell>
                      <TableCell>{post.postTier}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{post.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Platform Performance Overview Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">Platform Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="followers" fill="hsl(var(--primary))" name="Followers" />
                  <Bar dataKey="views" fill="hsl(var(--secondary))" name="Views" />
                  <Bar dataKey="interactions" fill="hsl(var(--accent))" name="Interactions" />
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
                <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                <TabsTrigger value="x">X</TabsTrigger>
                <TabsTrigger value="youtube">YouTube</TabsTrigger>
              </TabsList>

              {/* Instagram Tab */}
              <TabsContent value="instagram" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{instagramData.totalFollowers}</div>
                      <p className="text-xs text-muted-foreground">
                        Followers (+{instagramData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{instagramData.engagementRate}%</span>
                        {getTrendIndicator(instagramData.engagementRate, instagramData.lastWeekEngagementRate)}
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{instagramData.totalContent}</span>
                        {getTrendIndicator(String(instagramData.totalContent), String(instagramData.lastWeekTotalContent))}
                      </div>
                      <p className="text-xs text-muted-foreground">Total Content</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search content..."
                      value={instagramSearch}
                      onChange={(e) => setInstagramSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={instagramFilter} onValueChange={setInstagramFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="reel">Reel</SelectItem>
                      <SelectItem value="photo">Photo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
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
                      {filteredInstagramContent.map((content, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant={content.type === "Reel" ? "default" : "secondary"}>
                              {content.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{content.date}</TableCell>
                          <TableCell>{content.reach}</TableCell>
                          <TableCell>{content.views}</TableCell>
                          <TableCell>{content.likes}</TableCell>
                          <TableCell>{content.comments}</TableCell>
                          <TableCell>{content.shares}</TableCell>
                          <TableCell>{content.interactions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Facebook Tab */}
              <TabsContent value="facebook" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{facebookData.totalFollowers}</div>
                      <p className="text-xs text-muted-foreground">
                        Followers (+{facebookData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{facebookData.engagementRate}%</span>
                        {getTrendIndicator(facebookData.engagementRate, facebookData.lastWeekEngagementRate)}
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{facebookData.totalContent}</span>
                        {getTrendIndicator(String(facebookData.totalContent), String(facebookData.lastWeekTotalContent))}
                      </div>
                      <p className="text-xs text-muted-foreground">Total Content</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search content..."
                      value={facebookSearch}
                      onChange={(e) => setFacebookSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={facebookFilter} onValueChange={setFacebookFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="reel">Reel</SelectItem>
                      <SelectItem value="photo">Photo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
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
                        <TableHead>Link Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFacebookContent.map((content, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant={content.type === "Reel" ? "default" : "secondary"}>
                              {content.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{content.date}</TableCell>
                          <TableCell>{content.reach}</TableCell>
                          <TableCell>{content.views}</TableCell>
                          <TableCell>{content.likes}</TableCell>
                          <TableCell>{content.comments}</TableCell>
                          <TableCell>{content.shares}</TableCell>
                          <TableCell>{content.interactions}</TableCell>
                          <TableCell>{content.linkClicks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* TikTok Tab */}
              <TabsContent value="tiktok" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{tiktokData.totalFollowers}</div>
                      <p className="text-xs text-muted-foreground">
                        Followers ({tiktokData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{tiktokData.engagementRate}%</span>
                        {getTrendIndicator(tiktokData.engagementRate, tiktokData.lastWeekEngagementRate)}
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{tiktokData.totalContent}</span>
                        {getTrendIndicator(String(tiktokData.totalContent), String(tiktokData.lastWeekTotalContent))}
                      </div>
                      <p className="text-xs text-muted-foreground">Total Content</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={tiktokSearch}
                    onChange={(e) => setTiktokSearch(e.target.value)}
                    className="pl-10"
                  />
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
                        <TableHead>Favorites</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTiktokContent.map((content, index) => (
                        <TableRow key={index}>
                          <TableCell>{content.date}</TableCell>
                          <TableCell>{content.views}</TableCell>
                          <TableCell>{content.likes}</TableCell>
                          <TableCell>{content.comments}</TableCell>
                          <TableCell>{content.shares}</TableCell>
                          <TableCell>{content.favorites}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* X Tab */}
              <TabsContent value="x" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{xData.totalFollowers}</div>
                      <p className="text-xs text-muted-foreground">
                        Followers ({xData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{xData.engagementRate}%</span>
                        {getTrendIndicator(xData.engagementRate, xData.lastWeekEngagementRate)}
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{xData.totalContent}</span>
                        {getTrendIndicator(String(xData.totalContent), String(xData.lastWeekTotalContent))}
                      </div>
                      <p className="text-xs text-muted-foreground">Total Content</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={xSearch}
                    onChange={(e) => setXSearch(e.target.value)}
                    className="pl-10"
                  />
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
                      {filteredXContent.map((content, index) => (
                        <TableRow key={index}>
                          <TableCell>{content.date}</TableCell>
                          <TableCell>{content.impressions}</TableCell>
                          <TableCell>{content.engagements}</TableCell>
                          <TableCell>{content.profileVisits}</TableCell>
                          <TableCell>{content.linkClicks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* YouTube Tab */}
              <TabsContent value="youtube" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{youtubeData.totalFollowers}</div>
                      <p className="text-xs text-muted-foreground">
                        Subscribers ({youtubeData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{youtubeData.engagementRate}%</span>
                        {getTrendIndicator(youtubeData.engagementRate, youtubeData.lastWeekEngagementRate)}
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{youtubeData.totalContent}</span>
                        {getTrendIndicator(String(youtubeData.totalContent), String(youtubeData.lastWeekTotalContent))}
                      </div>
                      <p className="text-xs text-muted-foreground">Total Content</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={youtubeSearch}
                    onChange={(e) => setYoutubeSearch(e.target.value)}
                    className="pl-10"
                  />
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
                      {filteredYoutubeContent.map((content, index) => (
                        <TableRow key={index}>
                          <TableCell>{content.date}</TableCell>
                          <TableCell>{content.duration}</TableCell>
                          <TableCell>{content.likes}</TableCell>
                          <TableCell>{content.comments}</TableCell>
                          <TableCell>{content.shares}</TableCell>
                          <TableCell>{content.views}</TableCell>
                          <TableCell>{content.subscribers}</TableCell>
                          <TableCell>{content.impressions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OxiSureTechDec1to7;
