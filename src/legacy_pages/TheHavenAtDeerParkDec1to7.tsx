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
  platform: string;
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
    link: "https://www.facebook.com/reel/1387745146133731/",
    views: "426",
    engagementPercent: "3.99%",
    platform: "Facebook",
    followers: 75,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 2,
    conversionSignals: 2,
    totalScore: 66,
    postTier: "3 (Growth)",
    notes: "Solid engagement and strong share",
  },
  {
    link: "https://www.instagram.com/reel/DR5MaPNDwGs/",
    views: "310",
    engagementPercent: "2.94%",
    platform: "Instagram",
    followers: 31,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 2,
    conversionSignals: 2,
    totalScore: 52,
    postTier: "4 (Presence)",
    notes: "Decent reach but limited interaction;",
  },
  {
    link: "https://www.facebook.com/reel/737405532730550/",
    views: "247",
    engagementPercent: "1.81%",
    platform: "Facebook",
    followers: 75,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 2,
    conversionSignals: 2,
    totalScore: 45,
    postTier: "4 (Presence)",
    notes: "Low engagement;",
  },
];

const instagramData = {
  oldFollowers: 29,
  addedFollowers: 2,
  totalFollowers: 31,
  engagementRate: "56.01",
  lastWeekEngagementRate: "50.45",
  totalContent: 13,
  lastWeekTotalContent: 10,
};

const instagramContent: InstagramContent[] = [
  { type: "Photo", date: "Mon Dec 1, 10:00 AM", reach: 3, views: 17, likes: 3, comments: 3, shares: 0, interactions: 6 },
  { type: "Photo", date: "Tue Dec 2, 9:18 AM", reach: 6, views: 18, likes: 4, comments: 3, shares: 0, interactions: 7 },
  { type: "Photo", date: "Tue Dec 2, 11:19 AM", reach: 5, views: 17, likes: 4, comments: 3, shares: 0, interactions: 7 },
  { type: "Photo", date: "Wed Dec 3, 10:00 AM", reach: 7, views: 25, likes: 3, comments: 3, shares: 0, interactions: 6 },
  { type: "Photo", date: "Wed Dec 3, 11:00 AM", reach: 6, views: 18, likes: 3, comments: 3, shares: 0, interactions: 6 },
  { type: "Photo", date: "Thu Dec 4, 8:56 PM", reach: 4, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Thu Dec 4, 9:18 PM", reach: 7, views: 15, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Fri Dec 5, 10:52 AM", reach: 5, views: 22, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Fri Dec 5, 11:33 AM", reach: 246, views: 310, likes: 5, comments: 0, shares: 1, interactions: 6 },
  { type: "Photo", date: "Sat Dec 6, 10:00 AM", reach: 5, views: 16, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Sat Dec 6, 11:39 AM", reach: 109, views: 128, likes: 4, comments: 0, shares: 0, interactions: 4 },
  { type: "Photo", date: "Sun Dec 7, 10:00 AM", reach: 32, views: 54, likes: 1, comments: 0, shares: 1, interactions: 2 },
  { type: "Reel", date: "Sun Dec 7, 12:03 PM", reach: 141, views: 182, likes: 2, comments: 0, shares: 1, interactions: 3 },
];

const facebookData = {
  oldFollowers: 72,
  addedFollowers: 3,
  totalFollowers: 75,
  engagementRate: "54.40",
  lastWeekEngagementRate: "53.63",
  totalContent: 13,
  lastWeekTotalContent: 11,
};

const facebookContent: FacebookContent[] = [
  { type: "Photo", date: "Mon Dec 1, 10:00 AM", reach: 24, views: 34, likes: 8, comments: 0, shares: 0, interactions: 8, linkClicks: 1 },
  { type: "Photo", date: "Tue Dec 2, 9:18 AM", reach: 51, views: 85, likes: 8, comments: 0, shares: 2, interactions: 10, linkClicks: 0 },
  { type: "Photo", date: "Tue Dec 2, 11:19 AM", reach: 31, views: 59, likes: 9, comments: 0, shares: 2, interactions: 11, linkClicks: 2 },
  { type: "Photo", date: "Wed Dec 3, 10:00 AM", reach: 25, views: 75, likes: 8, comments: 2, shares: 6, interactions: 16, linkClicks: 0 },
  { type: "Photo", date: "Wed Dec 3, 11:00 AM", reach: 25, views: 57, likes: 8, comments: 1, shares: 13, interactions: 22, linkClicks: 2 },
  { type: "Photo", date: "Thu Dec 4, 8:56 PM", reach: 18, views: 32, likes: 5, comments: 0, shares: 0, interactions: 5, linkClicks: 0 },
  { type: "Photo", date: "Thu Dec 4, 9:18 PM", reach: 60, views: 98, likes: 6, comments: 0, shares: 1, interactions: 7, linkClicks: 0 },
  { type: "Photo", date: "Fri Dec 5, 10:52 AM", reach: 20, views: 43, likes: 6, comments: 0, shares: 2, interactions: 8, linkClicks: 0 },
  { type: "Reel", date: "Fri Dec 5, 11:33 AM", reach: 222, views: 426, likes: 7, comments: 0, shares: 10, interactions: 17, linkClicks: 0 },
  { type: "Photo", date: "Sat Dec 6, 10:00 AM", reach: 10, views: 20, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Sat Dec 6, 11:38 AM", reach: 63, views: 78, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sun Dec 7, 10:00 AM", reach: 15, views: 22, likes: 2, comments: 0, shares: 1, interactions: 3, linkClicks: 0 },
  { type: "Reel", date: "Sun Dec 7, 12:02 PM", reach: 212, views: 247, likes: 2, comments: 0, shares: 0, interactions: 2, linkClicks: 0 },
];

const tiktokData = {
  oldFollowers: 5,
  addedFollowers: "-",
  totalFollowers: 5,
  engagementRate: "5.61",
  lastWeekEngagementRate: "3.21",
  totalContent: 11,
  lastWeekTotalContent: 11,
};

const tiktokContent: TikTokContent[] = [
  { date: "December 01, 2025", views: 93, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 02, 2025", views: 91, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 02, 2025", views: 92, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 02, 2025", views: 94, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 03, 2025", views: 93, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 05, 2025", views: 91, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 05, 2025", views: 105, likes: 2, comments: 1, shares: 0, favorites: 0 },
  { date: "December 06, 2025", views: 97, likes: 3, comments: 0, shares: 0, favorites: 0 },
  { date: "December 06, 2025", views: 98, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 07, 2025", views: 97, likes: 2, comments: 0, shares: 0, favorites: 0 },
  { date: "December 07, 2025", views: 95, likes: 2, comments: 0, shares: 0, favorites: 0 },
];

const xData = {
  oldFollowers: 9,
  addedFollowers: 1,
  totalFollowers: 10,
  engagementRate: "73.77",
  lastWeekEngagementRate: "71.43",
  totalContent: 11,
  lastWeekTotalContent: 9,
};

const xContent: XContent[] = [
  { date: "Dec 1 2025", impressions: 9, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 2 2025", impressions: 7, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 2 2025", impressions: 18, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 2 2025", impressions: 15, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 3 2025", impressions: 27, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 5 2025", impressions: 6, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 5 2025", impressions: 11, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 6 2025", impressions: 7, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 6 2025", impressions: 12, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 7 2025", impressions: 8, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 7 2025", impressions: 2, engagements: 3, profileVisits: 0, linkClicks: 0 },
];

const youtubeData = {
  oldFollowers: 5,
  addedFollowers: "-",
  totalFollowers: 5,
  engagementRate: "No Data",
  lastWeekEngagementRate: "-",
  totalContent: 12,
  lastWeekTotalContent: "-",
};

const youtubeContent: YouTubeContent[] = [
  { date: "Dec 5, 2025", duration: 9, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 17 },
  { date: "Dec 6, 2025", duration: 9, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0, impressions: 82 },
  { date: "Dec 7, 2025", duration: 9, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 11 },
];

const chartData = [
  {
    name: "Instagram",
    followers: instagramData.totalFollowers,
    views: 779,
    interactions: 28,
  },
  {
    name: "Facebook",
    followers: facebookData.totalFollowers,
    views: 1098,
    interactions: 81,
  },
  {
    name: "TikTok",
    followers: tiktokData.totalFollowers,
    views: 554,
    interactions: 12,
  },
  {
    name: "X",
    followers: xData.totalFollowers,
    views: 122,
    interactions: 45,
  },
  {
    name: "YouTube",
    followers: youtubeData.totalFollowers,
    views: 1,
    interactions: 0,
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

const TheHavenAtDeerParkDec1to7 = () => {
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
      post.platform.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
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
    if (current === "No Data" || previous === "-" || current === "-" || previous === "No Data") return null;
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
          <h1 className="text-3xl font-bold text-foreground">The Haven at Deer Park</h1>
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
                    <TableHead>Platform</TableHead>
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
                      <TableCell>{post.platform}</TableCell>
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
                        Followers (+{xData.addedFollowers} new)
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
                        <span className="text-2xl font-bold">{youtubeData.engagementRate}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{youtubeData.totalContent}</span>
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

export default TheHavenAtDeerParkDec1to7;
