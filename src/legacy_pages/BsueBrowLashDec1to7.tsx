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
    link: "https://www.youtube.com/shorts/SZwuvQksKfI",
    views: "2,009",
    engagementPercent: "2.81%",
    platform: "Youtube",
    followers: 5,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 1,
    conversionSignals: 1,
    totalScore: 48,
    postTier: "4 (Presence)",
    notes: "Excellent reach but low engagement depth",
  },
  {
    link: "https://www.facebook.com/reel/1137496151889197",
    views: "66",
    engagementPercent: "3.81%",
    platform: "Facebook",
    followers: 15,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 1,
    conversionSignals: 1,
    totalScore: 47,
    postTier: "4 (Presence)",
    notes: "low engagement",
  },
  {
    link: "https://www.facebook.com/reel/1770073790357429",
    views: "49",
    engagementPercent: "1.14%",
    platform: "Facebook",
    followers: 15,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 1,
    conversionSignals: 1,
    totalScore: 40,
    postTier: "4 (Presence)",
    notes: "low engagement",
  },
];

const instagramData = {
  oldFollowers: 11,
  addedFollowers: "-",
  totalFollowers: 11,
  engagementRate: "9.33",
  lastWeekEngagementRate: "-",
  totalContent: 7,
  lastWeekTotalContent: "-",
};

const instagramContent: InstagramContent[] = [
  { type: "Photo", date: "Mon Dec 1, 10:00 AM", reach: 4, views: 6, likes: 5, comments: 4, shares: 0, interactions: 9 },
  { type: "Photo", date: "Tue Dec 2, 10:30 AM", reach: 2, views: 6, likes: 5, comments: 4, shares: 0, interactions: 9 },
  { type: "Photo", date: "Wed Dec 3, 10:08 AM", reach: 3, views: 9, likes: 4, comments: 4, shares: 0, interactions: 8 },
  { type: "Photo", date: "Thu Dec 4, 8:51 PM", reach: 3, views: 2, likes: 1, comments: 1, shares: 0, interactions: 2 },
  { type: "Photo", date: "Fri Dec 5, 9:48 AM", reach: 2, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sat Dec 6, 10:02 AM", reach: 0, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sun Dec 7, 10:44 AM", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0 },
];

const facebookData = {
  oldFollowers: 15,
  addedFollowers: "-",
  totalFollowers: 15,
  engagementRate: "27.76",
  lastWeekEngagementRate: "-",
  totalContent: 11,
  lastWeekTotalContent: "-",
};

const facebookContent: FacebookContent[] = [
  { type: "Photo", date: "Mon Dec 1, 10:00 AM", reach: 9, views: 9, likes: 8, comments: 0, shares: 0, interactions: 8, linkClicks: 0 },
  { type: "Reel", date: "Mon Dec 1, 11:50 AM", reach: 10, views: 18, likes: 8, comments: 0, shares: 8, interactions: 16, linkClicks: 1 },
  { type: "Reel", date: "Tue Dec 2, 9:49 AM", reach: 19, views: 25, likes: 8, comments: 0, shares: 5, interactions: 13, linkClicks: 0 },
  { type: "Photo", date: "Tue Dec 2, 9:52 AM", reach: 11, views: 24, likes: 9, comments: 0, shares: 1, interactions: 10, linkClicks: 0 },
  { type: "Photo", date: "Wed Dec 3, 10:28 AM", reach: 10, views: 17, likes: 7, comments: 0, shares: 5, interactions: 12, linkClicks: 0 },
  { type: "Reel", date: "Wed Dec 3, 11:31 AM", reach: 18, views: 66, likes: 8, comments: 0, shares: 9, interactions: 17, linkClicks: 1 },
  { type: "Reel", date: "Thu Dec 4, 9:13 PM", reach: 22, views: 24, likes: 7, comments: 0, shares: 0, interactions: 7, linkClicks: 0 },
  { type: "Photo", date: "Thu Dec 4, 9:50 PM", reach: 7, views: 15, likes: 6, comments: 0, shares: 3, interactions: 9, linkClicks: 0 },
  { type: "Photo", date: "Fri Dec 5, 9:46 AM", reach: 7, views: 15, likes: 6, comments: 0, shares: 0, interactions: 6, linkClicks: 0 },
  { type: "Reel", date: "Fri Dec 5, 10:00 AM", reach: 21, views: 48, likes: 6, comments: 0, shares: 11, interactions: 17, linkClicks: 0 },
  { type: "Photo", date: "Sat Dec 6, 10:01 AM", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sat Dec 6, 11:00 AM", reach: 8, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sat Dec 6, 11:07 AM", reach: 39, views: 49, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sun Dec 7, 10:00 AM", reach: 0, views: 0, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sun Dec 7, 11:09 AM", reach: 1, views: 1, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
];

const xData = {
  oldFollowers: 10,
  addedFollowers: "-",
  totalFollowers: 10,
  engagementRate: "35.80",
  lastWeekEngagementRate: "-",
  totalContent: 15,
  lastWeekTotalContent: "-",
};

const xContent: XContent[] = [
  { date: "Dec 1 2025", impressions: 13, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 1 2025", impressions: 8, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 2 2025", impressions: 14, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 2 2025", impressions: 24, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 3 2025", impressions: 16, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 3 2025", impressions: 16, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 4 2025", impressions: 11, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 4 2025", impressions: 13, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 4 2025", impressions: 9, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 5 2025", impressions: 31, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 5 2025", impressions: 8, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 6 2025", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 6 2025", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 7 2025", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { date: "Dec 7 2025", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 },
];

const youtubeData = {
  oldFollowers: 5,
  addedFollowers: "-",
  totalFollowers: 5,
  engagementRate: "3.71",
  lastWeekEngagementRate: "-",
  totalContent: 12,
  lastWeekTotalContent: "-",
};

const youtubeContent: YouTubeContent[] = [
  { date: "Dec 5, 2025", duration: 15, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 8 },
  { date: "Dec 5, 2025", duration: 11, likes: 14, comments: 0, shares: 0, views: 2020, subscribers: 1, impressions: 41 },
  { date: "Dec 6, 2025", duration: 41, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 1 },
  { date: "Dec 6, 2025", duration: 11, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 4 },
  { date: "Dec 6, 2025", duration: 16, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 1 },
  { date: "Dec 7, 2025", duration: 10, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 1 },
];

const chartData = [
  {
    name: "Instagram",
    followers: instagramData.totalFollowers,
    views: 26,
    interactions: 28,
  },
  {
    name: "Facebook",
    followers: facebookData.totalFollowers,
    views: 245,
    interactions: 68,
  },
  {
    name: "X",
    followers: xData.totalFollowers,
    views: 176,
    interactions: 63,
  },
  {
    name: "YouTube",
    followers: youtubeData.totalFollowers,
    views: 2020,
    interactions: 14,
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

const BsueBrowLashDec1to7 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [instagramSearch, setInstagramSearch] = useState("");
  const [facebookSearch, setFacebookSearch] = useState("");
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
          <h1 className="text-3xl font-bold text-foreground">BSUE Brow & Lash</h1>
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
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
                        Followers ({instagramData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{instagramData.engagementRate}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{instagramData.totalContent}</span>
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
                        Followers ({facebookData.addedFollowers} new)
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{facebookData.engagementRate}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{facebookData.totalContent}</span>
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
                      </div>
                      <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">{xData.totalContent}</span>
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

export default BsueBrowLashDec1to7;
