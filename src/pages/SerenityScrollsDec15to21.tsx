import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Users, Eye, Award, ExternalLink, Play, ThumbsUp, MessageCircle, Share2, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Serenity Scrolls logo
import serenityScrollsLogo from "@/assets/serenity-scrolls-logo.jpg";

const SerenityScrollsDec15to21 = () => {
  // Top performing posts data
  const topPosts = [
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
    },
  ];

  // Platform performance overview data
  const platformData = [
    {
      platform: "Instagram",
      followers: 49,
      newFollowers: 1,
      totalContent: 21,
      lastWeekContent: 19,
      engagementRate: null,
      lastWeekEngagement: 19.64,
    },
    {
      platform: "Facebook",
      followers: 26,
      newFollowers: 1,
      totalContent: 21,
      lastWeekContent: 20,
      engagementRate: 59.21,
      lastWeekEngagement: 56.00,
    },
    {
      platform: "TikTok",
      followers: 262,
      newFollowers: 35,
      totalContent: null,
      lastWeekContent: 17,
      engagementRate: 19.61,
      lastWeekEngagement: 27.11,
    },
    {
      platform: "X",
      followers: 10,
      newFollowers: 0,
      totalContent: null,
      lastWeekContent: 16,
      engagementRate: null,
      lastWeekEngagement: 54.00,
    },
  ];

  // Chart data for platform comparison
  const chartData = [
    { name: "Instagram", followers: 49, engagement: 0, fill: "#E4405F" },
    { name: "Facebook", followers: 26, engagement: 59.21, fill: "#1877F2" },
    { name: "TikTok", followers: 262, engagement: 19.61, fill: "#000000" },
    { name: "X", followers: 10, engagement: 0, fill: "#1DA1F2" },
  ];

  // TikTok content data
  interface TikTokContent {
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
  }

  const tiktokContent: TikTokContent[] = [
    { date: "Sunday, December 21, 2025", views: 233, likes: 22, comments: 3, shares: 0, bookmarks: 4 },
    { date: "Sunday, December 21, 2025", views: 180, likes: 24, comments: 6, shares: 0, bookmarks: 7 },
    { date: "Sunday, December 21, 2025", views: 180, likes: 3, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Sunday, December 21, 2025", views: 280, likes: 50, comments: 9, shares: 0, bookmarks: 8 },
    { date: "Sunday, December 21, 2025", views: 115, likes: 0, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Saturday, December 20, 2025", views: 195, likes: 19, comments: 8, shares: 0, bookmarks: 3 },
    { date: "Saturday, December 20, 2025", views: 130, likes: 0, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Saturday, December 20, 2025", views: 269, likes: 53, comments: 23, shares: 34, bookmarks: 19 },
    { date: "Saturday, December 20, 2025", views: 111, likes: 10, comments: 0, shares: 0, bookmarks: 1 },
    { date: "Thursday, December 18, 2025", views: 317, likes: 34, comments: 3, shares: 4, bookmarks: 5 },
    { date: "Thursday, December 18, 2025", views: 110, likes: 1, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Thursday, December 18, 2025", views: 216, likes: 18, comments: 1, shares: 7, bookmarks: 3 },
    { date: "Wednesday, December 17, 2025", views: 202, likes: 19, comments: 1, shares: 0, bookmarks: 3 },
    { date: "Wednesday, December 17, 2025", views: 319, likes: 37, comments: 6, shares: 15, bookmarks: 4 },
    { date: "Wednesday, December 17, 2025", views: 118, likes: 0, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Tuesday, December 16, 2025", views: 89, likes: 0, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Tuesday, December 16, 2025", views: 335, likes: 44, comments: 9, shares: 8, bookmarks: 4 },
    { date: "Tuesday, December 16, 2025", views: 338, likes: 32, comments: 2, shares: 0, bookmarks: 2 },
    { date: "Monday, December 15, 2025", views: 330, likes: 91, comments: 43, shares: 4, bookmarks: 16 },
    { date: "Monday, December 15, 2025", views: 198, likes: 19, comments: 7, shares: 1, bookmarks: 2 },
    { date: "Monday, December 15, 2025", views: 96, likes: 0, comments: 0, shares: 0, bookmarks: 0 },
    { date: "Monday, December 15, 2025", views: 210, likes: 41, comments: 7, shares: 0, bookmarks: 6 },
  ];

  // X content data (no data for this week)
  interface XContent {
    date: string;
    impressions: number;
    engagement: number;
    profileVisits: number;
    linkClicks: number;
  }

  const xContent: XContent[] = [];

  // Calculate TikTok totals
  const tiktokTotals = tiktokContent.reduce(
    (acc, item) => ({
      views: acc.views + item.views,
      likes: acc.likes + item.likes,
      comments: acc.comments + item.comments,
      shares: acc.shares + item.shares,
      bookmarks: acc.bookmarks + item.bookmarks,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0 }
  );

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      TikTok: "bg-black text-white",
      Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
      Facebook: "bg-blue-600 text-white",
      X: "bg-black text-white",
    };
    return colors[platform] || "bg-gray-500 text-white";
  };

  const getTierColor = (tier: string) => {
    if (tier.includes("1") || tier.includes("Influence")) return "bg-yellow-500 text-black";
    if (tier.includes("2")) return "bg-gray-400 text-black";
    if (tier.includes("3") || tier.includes("Growth")) return "bg-amber-600 text-white";
    return "bg-gray-500 text-white";
  };

  const MetricCard = ({ title, value, icon: Icon, subtitle }: { title: string; value: string | number; icon: React.ElementType; subtitle?: string }) => (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Icon className="h-8 w-8 text-primary opacity-80" />
        </div>
      </CardContent>
    </Card>
  );

  const renderTikTokTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-3 text-muted-foreground">Date</th>
            <th className="text-right p-3 text-muted-foreground">Views</th>
            <th className="text-right p-3 text-muted-foreground">Likes</th>
            <th className="text-right p-3 text-muted-foreground">Comments</th>
            <th className="text-right p-3 text-muted-foreground">Shares</th>
            <th className="text-right p-3 text-muted-foreground">Bookmarks</th>
          </tr>
        </thead>
        <tbody>
          {tiktokContent.map((item, idx) => (
            <tr key={idx} className="border-b border-border hover:bg-muted/50">
              <td className="p-3 text-foreground">{item.date}</td>
              <td className="p-3 text-right text-foreground">{item.views.toLocaleString()}</td>
              <td className="p-3 text-right text-foreground">{item.likes.toLocaleString()}</td>
              <td className="p-3 text-right text-foreground">{item.comments.toLocaleString()}</td>
              <td className="p-3 text-right text-foreground">{item.shares.toLocaleString()}</td>
              <td className="p-3 text-right text-foreground">{item.bookmarks.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="bg-muted/30 font-semibold">
            <td className="p-3 text-foreground">Total</td>
            <td className="p-3 text-right text-foreground">{tiktokTotals.views.toLocaleString()}</td>
            <td className="p-3 text-right text-foreground">{tiktokTotals.likes.toLocaleString()}</td>
            <td className="p-3 text-right text-foreground">{tiktokTotals.comments.toLocaleString()}</td>
            <td className="p-3 text-right text-foreground">{tiktokTotals.shares.toLocaleString()}</td>
            <td className="p-3 text-right text-foreground">{tiktokTotals.bookmarks.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderXTable = () => (
    <div className="overflow-x-auto">
      {xContent.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No X content data available for this period
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground">Date</th>
              <th className="text-right p-3 text-muted-foreground">Impressions</th>
              <th className="text-right p-3 text-muted-foreground">Engagement</th>
              <th className="text-right p-3 text-muted-foreground">Profile Visits</th>
              <th className="text-right p-3 text-muted-foreground">Link Clicks</th>
            </tr>
          </thead>
          <tbody>
            {xContent.map((item, idx) => (
              <tr key={idx} className="border-b border-border hover:bg-muted/50">
                <td className="p-3 text-foreground">{item.date}</td>
                <td className="p-3 text-right text-foreground">{item.impressions.toLocaleString()}</td>
                <td className="p-3 text-right text-foreground">{item.engagement.toLocaleString()}</td>
                <td className="p-3 text-right text-foreground">{item.profileVisits.toLocaleString()}</td>
                <td className="p-3 text-right text-foreground">{item.linkClicks.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <img
                src={serenityScrollsLogo}
                alt="Serenity Scrolls Logo"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Serenity Scrolls</h1>
                <p className="text-muted-foreground">Weekly Performance Report</p>
              </div>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              Dec 15 - 21, 2025
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Top Performing Insights */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Top Performing Insights
          </h2>
          <div className="grid gap-4">
            {topPosts.map((post, index) => (
              <Card key={index} className="bg-card border-border hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPlatformColor(post.platform)}>{post.platform}</Badge>
                        <Badge className={getTierColor(post.postTier)}>{post.postTier}</Badge>
                        <Badge variant="outline">Score: {post.totalScore}</Badge>
                      </div>
                      <a
                        href={post.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-sm break-all"
                      >
                        <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        View Post
                      </a>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-foreground">{post.views.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Views</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">{post.engagementPercent}%</p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{post.reachTier}</p>
                        <p className="text-xs text-muted-foreground">Reach Tier</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{post.engagementTier}</p>
                        <p className="text-xs text-muted-foreground">Eng. Tier</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Platform Performance Overview */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Platform Performance Overview
          </h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Followers by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="followers" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Platform Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {platformData.map((platform, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge className={getPlatformColor(platform.platform)}>{platform.platform}</Badge>
                        <div>
                          <p className="font-semibold text-foreground">{platform.followers.toLocaleString()} followers</p>
                          <p className="text-xs text-muted-foreground">
                            {platform.newFollowers !== null && platform.newFollowers > 0 
                              ? `+${platform.newFollowers} new` 
                              : "No change"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {platform.engagementRate !== null ? `${platform.engagementRate}%` : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Platform Content Performance */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Platform Content Performance
          </h2>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <Tabs defaultValue="tiktok" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="x">X</TabsTrigger>
                </TabsList>

                <TabsContent value="tiktok">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                      <MetricCard title="Total Views" value={tiktokTotals.views.toLocaleString()} icon={Eye} />
                      <MetricCard title="Total Likes" value={tiktokTotals.likes.toLocaleString()} icon={ThumbsUp} />
                      <MetricCard title="Total Comments" value={tiktokTotals.comments.toLocaleString()} icon={MessageCircle} />
                      <MetricCard title="Total Shares" value={tiktokTotals.shares.toLocaleString()} icon={Share2} />
                      <MetricCard title="Total Bookmarks" value={tiktokTotals.bookmarks.toLocaleString()} icon={Bookmark} />
                    </div>
                    {renderTikTokTable()}
                  </div>
                </TabsContent>

                <TabsContent value="x">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <MetricCard title="Total Impressions" value="0" icon={Eye} />
                      <MetricCard title="Total Engagement" value="0" icon={ThumbsUp} />
                      <MetricCard title="Profile Visits" value="0" icon={Users} />
                      <MetricCard title="Link Clicks" value="0" icon={ExternalLink} />
                    </div>
                    {renderXTable()}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default SerenityScrollsDec15to21;
