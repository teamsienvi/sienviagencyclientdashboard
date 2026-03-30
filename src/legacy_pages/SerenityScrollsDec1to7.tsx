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

interface TopPerformingPost {
  link: string;
  views: number;
  engagementPercent: number;
  platform: string;
  followers: number;
  reachTier: string;
  engagementTier: string;
  influence: number;
  totalScore: number;
  postTier: string;
  notes: string;
}

interface PlatformData {
  followers: number;
  addedFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
  totalContent: number;
  lastWeekTotalContent: number;
}

const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.youtube.com/watch?v=Lhq75dX_Lro",
    views: 1137,
    engagementPercent: 8.51,
    platform: "Youtube",
    followers: 4,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 80,
    totalScore: 78,
    postTier: "Tier 2 (Influence)",
    notes: "Strong engagement and solid reach"
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7579298626594213175",
    views: 353,
    engagementPercent: 31.45,
    platform: "Tiktok",
    followers: 111,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    totalScore: 90,
    postTier: "Tier 1 (Authority)",
    notes: "Exceptional engagement depth; this format delivers top-tier performance."
  },
  {
    link: "https://www.tiktok.com/@serenity_scrolls/video/7580185706253782286",
    views: 322,
    engagementPercent: 12.11,
    platform: "Tiktok",
    followers: 111,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    totalScore: 80,
    postTier: "Tier 2 (Influence)",
    notes: "Strong engagement for modest reach; content style clearly resonates."
  }
];

const instagramData: PlatformData = {
  followers: 45,
  addedFollowers: 2,
  engagementRate: 22.27,
  lastWeekEngagementRate: 21.47,
  totalContent: 21,
  lastWeekTotalContent: 17
};

const instagramContent = [
  { type: "Photo", date: "Monday, Dec 1", reach: "No data", views: 4, likesReactions: 2, comments: 2, shares: 0, interactions: 4 },
  { type: "Reel", date: "Monday, Dec 1", reach: 7, views: 10, likesReactions: 3, comments: 2, shares: 0, interactions: 5 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 15, views: 19, likesReactions: 5, comments: 2, shares: 0, interactions: 7 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 2, views: 6, likesReactions: 3, comments: 2, shares: 0, interactions: 5 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 169, views: 183, likesReactions: 10, comments: 2, shares: 0, interactions: 12 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 10, views: 13, likesReactions: 3, comments: 3, shares: 0, interactions: 6 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 144, views: 164, likesReactions: 17, comments: 3, shares: 1, interactions: 22 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: "No data", views: 7, likesReactions: 3, comments: 3, shares: 0, interactions: 6 },
  { type: "Photo", date: "Thursday, Dec 4", reach: 1, views: 7, likesReactions: 3, comments: 3, shares: 0, interactions: 6 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 8, views: 10, likesReactions: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 4, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Friday, Dec 5", reach: "No data", views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 2, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 8, views: 8, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
  { type: "Reel", date: "Friday, Dec 5", reach: "No data", views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 522, views: 647, likesReactions: 6, comments: 0, shares: 3, interactions: 10 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 11, views: 12, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Saturday, Dec 6", reach: "No data", views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 10, views: 13, likesReactions: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Photo", date: "Sunday, Dec 7", reach: "No data", views: 4, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: "No data", views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0 }
];

const facebookData: PlatformData = {
  followers: 23,
  addedFollowers: 1,
  engagementRate: 56.60,
  lastWeekEngagementRate: 52.31,
  totalContent: 21,
  lastWeekTotalContent: 21
};

const facebookContent = [
  { type: "Photo", date: "Monday, Dec 1", reach: "No data", views: 13, likesReactions: 9, comments: 0, shares: 1, interactions: 10, linkClicks: 0 },
  { type: "Reel", date: "Monday, Dec 1", reach: 2, views: 11, likesReactions: 9, comments: 0, shares: 0, interactions: 9, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: "No data", views: 17, likesReactions: 9, comments: 0, shares: 2, interactions: 11, linkClicks: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: "No data", views: 23, likesReactions: 9, comments: 0, shares: 1, interactions: 10, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: "No data", views: 20, likesReactions: 9, comments: 0, shares: 0, interactions: 9, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: "No data", views: 12, likesReactions: 7, comments: 0, shares: 2, interactions: 9, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 1, views: 12, likesReactions: 7, comments: 0, shares: 4, interactions: 11, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: "No data", views: 21, likesReactions: 7, comments: 0, shares: 6, interactions: 13, linkClicks: 0 },
  { type: "Photo", date: "Thursday, Dec 4", reach: "No data", views: 17, likesReactions: 6, comments: 0, shares: 9, interactions: 15, linkClicks: 0 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 6, views: 9, likesReactions: 5, comments: 0, shares: 0, interactions: 5, linkClicks: 0 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 6, views: 11, likesReactions: 5, comments: 0, shares: 0, interactions: 5, linkClicks: 0 },
  { type: "Photo", date: "Friday, Dec 5", reach: 6, views: 10, likesReactions: 5, comments: 0, shares: 1, interactions: 6, linkClicks: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 8, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 9, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 8, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 8, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 11, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Saturday, Dec 6", reach: 12, views: 0, likesReactions: 0, comments: 0, shares: 1, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 10, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sunday, Dec 7", reach: 10, views: 3, likesReactions: 0, comments: 0, shares: 1, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 11, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

const tiktokData: PlatformData = {
  followers: 119,
  addedFollowers: 8,
  engagementRate: 15.84,
  lastWeekEngagementRate: 22.01,
  totalContent: 18,
  lastWeekTotalContent: 12
};

const tiktokContent = [
  { type: "Video", date: "Monday, Dec 1", views: 77, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Monday, Dec 1", views: 154, likes: 26, comments: 5, shares: 3, addToFavorites: 3 },
  { type: "Video", date: "Tuesday, Dec 2", views: 51, likes: 9, comments: 2, shares: 1, addToFavorites: 1 },
  { type: "Video", date: "Tuesday, Dec 2", views: 353, likes: 56, comments: 39, shares: 16, addToFavorites: 17 },
  { type: "Video", date: "Tuesday, Dec 2", views: 75, likes: 8, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 2", views: 88, likes: 11, comments: 8, shares: 4, addToFavorites: 4 },
  { type: "Video", date: "Wednesday, Dec 3", views: 18, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 3", views: 135, likes: 4, comments: 2, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 4", views: 125, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 112, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 95, likes: 9, comments: 4, shares: 0, addToFavorites: 2 },
  { type: "Video", date: "Friday, Dec 5", views: 322, likes: 37, comments: 2, shares: 0, addToFavorites: 4 },
  { type: "Video", date: "Saturday, Dec 6", views: 47, likes: 8, comments: 3, shares: 2, addToFavorites: 1 },
  { type: "Video", date: "Saturday, Dec 6", views: 91, likes: 6, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 75, likes: 9, comments: 2, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Saturday, Dec 6", views: 83, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 273, likes: 28, comments: 1, shares: 1, addToFavorites: 1 },
  { type: "Video", date: "Saturday, Dec 6", views: 42, likes: 6, comments: 2, shares: 0, addToFavorites: 2 },
  { type: "Video", date: "Sunday, Dec 7", views: 9, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 7", views: 105, likes: 0, comments: 0, shares: 0, addToFavorites: 0 }
];

const xData: PlatformData = {
  followers: 10,
  addedFollowers: 0,
  engagementRate: 56.00,
  lastWeekEngagementRate: 51.60,
  totalContent: 17,
  lastWeekTotalContent: 16
};

const xContent = [
  { type: "Post", date: "Monday, Dec 1", impressions: 9, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Monday, Dec 1", impressions: 11, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 6, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 7, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 4, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 10, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 127, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 8, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 9, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 24, engagements: 5, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 8, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 4, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 8, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 3, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 4, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0 }
];

const youtubeData: PlatformData = {
  followers: 4,
  addedFollowers: 0,
  engagementRate: 13.21,
  lastWeekEngagementRate: 0,
  totalContent: 12,
  lastWeekTotalContent: 0
};

const youtubeContent = [
  { title: "Video 1", date: "Monday, Dec 1", duration: 11, likes: 0, comments: 0, shares: 0, views: 2, subscribers: 0 },
  { title: "Video 2", date: "Tuesday, Dec 2", duration: 88, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 3", date: "Tuesday, Dec 2", duration: 11, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 4", date: "Wednesday, Dec 3", duration: 9, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 5", date: "Saturday, Dec 6", duration: 31, likes: 86, comments: 0, shares: 1, views: 1337, subscribers: 3 },
  { title: "Video 6", date: "Saturday, Dec 6", duration: 43, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 7", date: "Saturday, Dec 6", duration: 56, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 8", date: "Saturday, Dec 6", duration: 13, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 9", date: "Saturday, Dec 6", duration: 26, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 10", date: "Saturday, Dec 6", duration: 10, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 11", date: "Sunday, Dec 7", duration: 21, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0 },
  { title: "Video 12", date: "Sunday, Dec 7", duration: 41, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0 }
];

const chartData = [
  { platform: "Instagram", followers: 45, views: 1075, interactions: 66 },
  { platform: "Facebook", followers: 23, views: 118, interactions: 75 },
  { platform: "TikTok", followers: 119, views: 2216, interactions: 351 },
  { platform: "X", followers: 10, views: 245, interactions: 56 },
  { platform: "YouTube", followers: 4, views: 1340, interactions: 87 }
];

const SerenityScrollsDec1to7 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [contentFilter, setContentFilter] = useState("All");

  const filteredTopPosts = topPerformingPosts.filter(post =>
    post.platform.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
    post.notes.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  const exportTopPostsCSV = () => {
    const headers = ["Link", "Views", "Engagement %", "Platform", "Followers", "Reach Tier", "Engagement Tier", "Influence", "Total Score", "Post Tier", "Notes"];
    const rows = topPerformingPosts.map(post => [
      post.link, post.views, post.engagementPercent, post.platform, post.followers,
      post.reachTier, post.engagementTier, post.influence, post.totalScore, post.postTier, post.notes
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "serenity_scrolls_top_posts_dec1-7.csv";
    a.click();
  };

  const TrendIndicator = ({ current, previous }: { current: number; previous: number }) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return null;
  };

  const MetricCard = ({ title, value, added, lastWeek, showTrend = false, currentValue, previousValue }: { 
    title: string; value: string | number; added?: number; lastWeek?: string; showTrend?: boolean; currentValue?: number; previousValue?: number;
  }) => (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-heading font-bold text-foreground">{value}</span>
          {added !== undefined && added > 0 && <span className="text-sm text-green-500 font-medium">+{added}</span>}
          {showTrend && currentValue !== undefined && previousValue !== undefined && <TrendIndicator current={currentValue} previous={previousValue} />}
        </div>
        {lastWeek && <p className="text-xs text-muted-foreground mt-1">Last week: {lastWeek}</p>}
      </CardContent>
    </Card>
  );

  const renderInstagramTable = () => {
    const filtered = instagramContent.filter(item => {
      const matchesSearch = item.date.toLowerCase().includes(contentSearch.toLowerCase());
      const matchesFilter = contentFilter === "All" || (contentFilter === "Reel" && item.type === "Reel") || (contentFilter === "Post" && item.type === "Photo");
      return matchesSearch && matchesFilter;
    });
    return (
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Reach</TableHead><TableHead>Views</TableHead><TableHead>Likes & Reactions</TableHead><TableHead>Comments</TableHead><TableHead>Shares</TableHead><TableHead>Interactions</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell><Badge variant={item.type === "Reel" ? "default" : "secondary"}>{item.type}</Badge></TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{typeof item.reach === 'number' ? item.reach.toLocaleString() : item.reach}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likesReactions}</TableCell>
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
    const filtered = facebookContent.filter(item => {
      const matchesSearch = item.date.toLowerCase().includes(contentSearch.toLowerCase());
      const matchesFilter = contentFilter === "All" || (contentFilter === "Reel" && item.type === "Reel") || (contentFilter === "Post" && item.type === "Photo");
      return matchesSearch && matchesFilter;
    });
    return (
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Reach</TableHead><TableHead>Views</TableHead><TableHead>Likes & Reactions</TableHead><TableHead>Comments</TableHead><TableHead>Shares</TableHead><TableHead>Interactions</TableHead><TableHead>Link Clicks</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell><Badge variant={item.type === "Reel" ? "default" : "secondary"}>{item.type}</Badge></TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{typeof item.reach === 'number' ? item.reach.toLocaleString() : item.reach}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likesReactions}</TableCell>
              <TableCell>{item.comments}</TableCell>
              <TableCell>{item.shares}</TableCell>
              <TableCell>{item.interactions}</TableCell>
              <TableCell>{item.linkClicks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderTikTokTable = () => {
    const filtered = tiktokContent.filter(item => item.date.toLowerCase().includes(contentSearch.toLowerCase()));
    return (
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Views</TableHead><TableHead>Likes</TableHead><TableHead>Comments</TableHead><TableHead>Shares</TableHead><TableHead>Add to Favorites</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell><Badge variant="default">{item.type}</Badge></TableCell>
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
    const filtered = xContent.filter(item => item.date.toLowerCase().includes(contentSearch.toLowerCase()));
    return (
      <Table>
        <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Impressions</TableHead><TableHead>Engagements</TableHead><TableHead>Profile Visits</TableHead><TableHead>Link Clicks</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.impressions.toLocaleString()}</TableCell>
              <TableCell>{item.engagements}</TableCell>
              <TableCell>{item.profileVisits}</TableCell>
              <TableCell>{item.linkClicks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderYouTubeTable = () => {
    const filtered = youtubeContent.filter(item => item.title.toLowerCase().includes(contentSearch.toLowerCase()) || item.date.toLowerCase().includes(contentSearch.toLowerCase()));
    return (
      <Table>
        <TableHeader><TableRow><TableHead className="w-[300px]">Title</TableHead><TableHead>Date</TableHead><TableHead>Duration (s)</TableHead><TableHead>Views</TableHead><TableHead>Likes</TableHead><TableHead>Comments</TableHead><TableHead>Shares</TableHead><TableHead>Subscribers</TableHead></TableRow></TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium max-w-[300px] truncate" title={item.title}>{item.title}</TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.duration}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likes}</TableCell>
              <TableCell>{item.comments}</TableCell>
              <TableCell>{item.shares}</TableCell>
              <TableCell>{item.subscribers}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" /><span>Back to Clients</span>
          </Link>

          <div className="mb-8 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Serenity Scrolls</h1>
                <p className="text-muted-foreground text-lg">Weekly Performance Insights (Dec 1-7)</p>
              </div>
              <Button className="gap-2 bg-primary hover:bg-primary/90"><Activity className="h-4 w-4" />Live Data</Button>
            </div>
          </div>

          <Card className="mb-8 animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-2xl font-heading">Top Performing Insights</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search posts..." value={topPostsSearch} onChange={(e) => setTopPostsSearch(e.target.value)} className="pl-10 w-64" />
                </div>
                <Button variant="outline" onClick={exportTopPostsCSV} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead><TableHead>Views</TableHead><TableHead>Engagement %</TableHead><TableHead>Platform</TableHead><TableHead>Followers</TableHead>
                    <TableHead><div className="flex items-center gap-1">Reach Tier<Tooltip><TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>Tier 1: 1M+ views</p><p>Tier 2: 500K-1M</p><p>Tier 3: 100K-500K</p><p>Tier 4: 50K-100K</p><p>Tier 5: &lt;50K</p></TooltipContent></Tooltip></div></TableHead>
                    <TableHead><div className="flex items-center gap-1">Engagement Tier<Tooltip><TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger><TooltipContent><p>Tier 1: 8%+</p><p>Tier 2: 5-8%</p><p>Tier 3: 3-5%</p><p>Tier 4: 1-3%</p><p>Tier 5: &lt;1%</p></TooltipContent></Tooltip></div></TableHead>
                    <TableHead>Total Score</TableHead><TableHead>Post Tier</TableHead><TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPosts.map((post, idx) => (
                    <TableRow key={idx}>
                      <TableCell><a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">View <ExternalLink className="h-3 w-3" /></a></TableCell>
                      <TableCell>{post.views.toLocaleString()}</TableCell>
                      <TableCell>{post.engagementPercent}%</TableCell>
                      <TableCell><Badge variant="outline">{post.platform}</Badge></TableCell>
                      <TableCell>{post.followers.toLocaleString()}</TableCell>
                      <TableCell>{post.reachTier}</TableCell>
                      <TableCell>{post.engagementTier}</TableCell>
                      <TableCell>{post.totalScore}</TableCell>
                      <TableCell>{post.postTier}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={post.notes}>{post.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mb-8 animate-fade-in">
            <CardHeader><CardTitle className="text-2xl font-heading">Platform Performance Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="platform" className="text-muted-foreground" />
                    <YAxis className="text-muted-foreground" />
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

          <Card className="animate-fade-in">
            <CardHeader><CardTitle className="text-2xl font-heading">Platform Content Performance</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="instagram" className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="x">X</TabsTrigger>
                  <TabsTrigger value="youtube">YouTube</TabsTrigger>
                </TabsList>

                <TabsContent value="instagram">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={instagramData.followers} added={instagramData.addedFollowers} />
                    <MetricCard title="Engagement Rate %" value={`${instagramData.engagementRate}%`} lastWeek={`${instagramData.lastWeekEngagementRate}%`} showTrend currentValue={instagramData.engagementRate} previousValue={instagramData.lastWeekEngagementRate} />
                    <MetricCard title="Total Content" value={instagramData.totalContent} lastWeek={String(instagramData.lastWeekTotalContent)} showTrend currentValue={instagramData.totalContent} previousValue={instagramData.lastWeekTotalContent} />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search content..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="pl-10" /></div>
                    <div className="flex gap-2">{["All", "Reel", "Post"].map((filter) => (<Button key={filter} variant={contentFilter === filter ? "default" : "outline"} size="sm" onClick={() => setContentFilter(filter)}>{filter}</Button>))}</div>
                  </div>
                  {renderInstagramTable()}
                </TabsContent>

                <TabsContent value="facebook">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={facebookData.followers} added={facebookData.addedFollowers} />
                    <MetricCard title="Engagement Rate %" value={`${facebookData.engagementRate}%`} lastWeek={`${facebookData.lastWeekEngagementRate}%`} showTrend currentValue={facebookData.engagementRate} previousValue={facebookData.lastWeekEngagementRate} />
                    <MetricCard title="Total Content" value={facebookData.totalContent} lastWeek={String(facebookData.lastWeekTotalContent)} showTrend currentValue={facebookData.totalContent} previousValue={facebookData.lastWeekTotalContent} />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search content..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="pl-10" /></div>
                    <div className="flex gap-2">{["All", "Reel", "Post"].map((filter) => (<Button key={filter} variant={contentFilter === filter ? "default" : "outline"} size="sm" onClick={() => setContentFilter(filter)}>{filter}</Button>))}</div>
                  </div>
                  {renderFacebookTable()}
                </TabsContent>

                <TabsContent value="tiktok">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={tiktokData.followers} added={tiktokData.addedFollowers} />
                    <MetricCard title="Engagement Rate %" value={`${tiktokData.engagementRate}%`} lastWeek={`${tiktokData.lastWeekEngagementRate}%`} showTrend currentValue={tiktokData.engagementRate} previousValue={tiktokData.lastWeekEngagementRate} />
                    <MetricCard title="Total Content" value={tiktokData.totalContent} lastWeek={String(tiktokData.lastWeekTotalContent)} showTrend currentValue={tiktokData.totalContent} previousValue={tiktokData.lastWeekTotalContent} />
                  </div>
                  <div className="flex items-center gap-4 mb-4"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search content..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="pl-10" /></div></div>
                  {renderTikTokTable()}
                </TabsContent>

                <TabsContent value="x">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={xData.followers} added={xData.addedFollowers} />
                    <MetricCard title="Engagement Rate %" value={`${xData.engagementRate}%`} lastWeek={`${xData.lastWeekEngagementRate}%`} showTrend currentValue={xData.engagementRate} previousValue={xData.lastWeekEngagementRate} />
                    <MetricCard title="Total Content" value={xData.totalContent} lastWeek={String(xData.lastWeekTotalContent)} showTrend currentValue={xData.totalContent} previousValue={xData.lastWeekTotalContent} />
                  </div>
                  <div className="flex items-center gap-4 mb-4"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search content..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="pl-10" /></div></div>
                  {renderXTable()}
                </TabsContent>

                <TabsContent value="youtube">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={youtubeData.followers} added={youtubeData.addedFollowers} />
                    <MetricCard title="Engagement Rate %" value={`${youtubeData.engagementRate}%`} lastWeek={youtubeData.lastWeekEngagementRate > 0 ? `${youtubeData.lastWeekEngagementRate}%` : "N/A"} />
                    <MetricCard title="Total Content" value={youtubeData.totalContent} lastWeek={youtubeData.lastWeekTotalContent > 0 ? String(youtubeData.lastWeekTotalContent) : "N/A"} />
                  </div>
                  <div className="flex items-center gap-4 mb-4"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search content..." value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="pl-10" /></div></div>
                  {renderYouTubeTable()}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default SerenityScrollsDec1to7;
