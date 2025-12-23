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
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  addToFavorites: number;
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
  engagement: number;
  profileVisits: number;
  linkClicks: number;
  type: string;
}

interface PlatformData {
  followers: number;
  addedFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
  totalContent: number;
  lastWeekTotalContent: number;
}

// Data from CSV - Dec 15-21
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.tiktok.com/@snarkypets/video/7586005274620595511",
    views: 201,
    engagementPercent: 2.10,
    platform: "TikTok",
    followers: 2197,
    reachTier: "Tier 5",
    engagementTier: "Tier 4",
    influence: 1,
    conversion: 1,
    totalScore: 44,
    postTier: "4 (Presence)",
    notes: "Limited reach but just enough interaction"
  },
  {
    link: "https://www.instagram.com/reel/DSSvz-FglM7/",
    views: 130,
    engagementPercent: 2.13,
    platform: "Instagram",
    followers: 104,
    reachTier: "Tier 5",
    engagementTier: "Tier 5",
    influence: 1,
    conversion: 1,
    totalScore: 43,
    postTier: "5 (Awareness)",
    notes: "Small reach and engagement"
  },
  {
    link: "https://www.instagram.com/reel/DSVS4HUjZlL/",
    views: 114,
    engagementPercent: 1.10,
    platform: "Instagram",
    followers: 104,
    reachTier: "Tier 5",
    engagementTier: "Tier 5",
    influence: 1,
    conversion: 1,
    totalScore: 41,
    postTier: "5 (Awareness)",
    notes: "Small reach and engagement"
  }
];

// Instagram Data
const instagramData: PlatformData = {
  followers: 104,
  addedFollowers: 1,
  engagementRate: 21.87,
  lastWeekEngagementRate: 21.16,
  totalContent: 18,
  lastWeekTotalContent: 17
};

// Instagram Content from CSV
const instagramContent: InstagramContent[] = [
  { type: "Reel", date: "Monday, Dec 15", reach: 102, views: 130, likes: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Photo", date: "Monday, Dec 15", reach: 2, views: 6, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 34, views: 44, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 103, views: 114, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 9, views: 16, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 34, views: 35, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Photo", date: "Wednesday, Dec 17", reach: 4, views: 6, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 50, views: 58, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Thursday, Dec 18", reach: 3, views: 8, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Thursday, Dec 18", reach: 46, views: 65, likes: 2, comments: 0, shares: 4, interactions: 6 },
  { type: "Reel", date: "Thursday, Dec 18", reach: 101, views: 114, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Photo", date: "Saturday, Dec 20", reach: 5, views: 12, likes: 2, comments: 0, shares: 0, interactions: 2 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 8, views: 10, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 4, views: 6, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 55, views: 59, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 58, views: 65, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 10, views: 13, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sunday, Dec 21", reach: 1, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0 }
];

// Facebook Data
const facebookData: PlatformData = {
  followers: 3140,
  addedFollowers: 0,
  engagementRate: 23.17,
  lastWeekEngagementRate: 20.03,
  totalContent: 25,
  lastWeekTotalContent: 19
};

// Facebook Content from CSV
const facebookContent: FacebookContent[] = [
  { type: "Reel", date: "Monday, Dec 15", reach: 13, views: 30, likes: 3, comments: 0, shares: 0, interactions: 3, linkClicks: 0 },
  { type: "Reel", date: "Monday, Dec 15", reach: 11, views: 31, likes: 0, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Photo", date: "Monday, Dec 15", reach: 10, views: 11, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 15, views: 14, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Photo", date: "Tuesday, Dec 16", reach: 25, views: 40, likes: 2, comments: 1, shares: 0, interactions: 3, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 8, views: 30, likes: 2, comments: 0, shares: 0, interactions: 2, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 12, views: 15, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 4, views: 18, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 7, views: 15, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 17", reach: 7, views: 8, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 5, views: 11, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Thursday, Dec 18", reach: 5, views: 6, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Thursday, Dec 18", reach: 5, views: 13, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Thursday, Dec 18", reach: 5, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Saturday, Dec 20", reach: 3, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 5, views: 26, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 6, views: 17, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 3, views: 10, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 3, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Saturday, Dec 20", reach: 3, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 4, views: 17, likes: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Photo", date: "Sunday, Dec 21", reach: 3, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Multi media", date: "Sunday, Dec 21", reach: 8, views: 10, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 4, views: 10, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 5, views: 9, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

// TikTok Data
const tiktokData: PlatformData = {
  followers: 2197,
  addedFollowers: 4,
  engagementRate: 8.90,
  lastWeekEngagementRate: 7.61,
  totalContent: 22,
  lastWeekTotalContent: 19
};

const tiktokContent: TikTokContent[] = [
  { date: "Monday, Dec 15", views: 4, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Monday, Dec 15", views: 2, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Monday, Dec 15", views: 71, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Tuesday, Dec 16", views: 5, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Tuesday, Dec 16", views: 57, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Tuesday, Dec 16", views: 1, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Wednesday, Dec 17", views: 117, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Wednesday, Dec 17", views: 89, likes: 1, comments: 0, shares: 0, addToFavorites: 1 },
  { date: "Wednesday, Dec 17", views: 46, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Thursday, Dec 18", views: 2, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Thursday, Dec 18", views: 95, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Thursday, Dec 18", views: 14, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Thursday, Dec 18", views: 73, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Saturday, Dec 20", views: 201, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Saturday, Dec 20", views: 89, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Saturday, Dec 20", views: 85, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Saturday, Dec 20", views: 0, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Saturday, Dec 20", views: 0, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Saturday, Dec 20", views: 77, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Sunday, Dec 21", views: 0, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Sunday, Dec 21", views: 0, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { date: "Sunday, Dec 21", views: 85, likes: 0, comments: 0, shares: 0, addToFavorites: 0 }
];

// X Data
const xData: PlatformData = {
  followers: 20,
  addedFollowers: 0,
  engagementRate: 35.98,
  lastWeekEngagementRate: 30.00,
  totalContent: 19,
  lastWeekTotalContent: 21
};

// X Content from CSV
const xContent: XContent[] = [
  { date: "Monday, Dec 15", impressions: 29, engagement: 9, profileVisits: 0, linkClicks: 0, type: "Post" },
  { date: "Monday, Dec 15", impressions: 11, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Monday, Dec 15", impressions: 11, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Tuesday, Dec 16", impressions: 11, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Tuesday, Dec 16", impressions: 15, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Tuesday, Dec 16", impressions: 44, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Wednesday, Dec 17", impressions: 8, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Post" },
  { date: "Wednesday, Dec 17", impressions: 11, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Wednesday, Dec 17", impressions: 21, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Thursday, Dec 18", impressions: 40, engagement: 3, profileVisits: 0, linkClicks: 0, type: "Post" },
  { date: "Thursday, Dec 18", impressions: 5, engagement: 6, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Thursday, Dec 18", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Saturday, Dec 20", impressions: 5, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Post" },
  { date: "Saturday, Dec 20", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Saturday, Dec 20", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Saturday, Dec 20", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Post" },
  { date: "Saturday, Dec 20", impressions: 6, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Saturday, Dec 20", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Sunday, Dec 21", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Sunday, Dec 21", impressions: 2, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Reel" },
  { date: "Sunday, Dec 21", impressions: 8, engagement: 2, profileVisits: 0, linkClicks: 0, type: "Post" }
];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 104, views: 763, interactions: 19 },
  { platform: "Facebook", followers: 3140, views: 383, interactions: 14 },
  { platform: "TikTok", followers: 2197, views: 1028, interactions: 5 },
  { platform: "X", followers: 20, views: 239, interactions: 86 }
];

const SnarkyPetsDec15to21 = () => {
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
    a.download = "snarky_pets_top_posts_dec15-21.csv";
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
              <TableCell>{item.reach.toLocaleString()}</TableCell>
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
            <TableHead>Link Clicks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant="default">{item.type}</Badge>
              </TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.reach.toLocaleString()}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likes}</TableCell>
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
    const filtered = tiktokContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
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
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
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
            <TableHead>Type</TableHead>
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
              <TableCell>
                <Badge variant="default">{item.type}</Badge>
              </TableCell>
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
            Snarky Pets
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
                    <TableHead>Notes</TableHead>
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
                          className="text-primary hover:underline flex items-center gap-1"
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
                      <TableCell>{post.followers.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.reachTier}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{post.engagementTier}</Badge>
                      </TableCell>
                      <TableCell>{post.influence}</TableCell>
                      <TableCell>{post.conversion}</TableCell>
                      <TableCell className="font-bold">{post.totalScore}</TableCell>
                      <TableCell>
                        <Badge>{post.postTier}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{post.notes}</TableCell>
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
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <RechartsTooltip />
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
                <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                <TabsTrigger value="x">X</TabsTrigger>
              </TabsList>

              <TabsContent value="instagram">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Total Followers" 
                    value={instagramData.followers.toLocaleString()} 
                    added={instagramData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${instagramData.engagementRate}%`}
                    lastWeek={`${instagramData.lastWeekEngagementRate}%`}
                    showTrend
                    currentValue={instagramData.engagementRate}
                    previousValue={instagramData.lastWeekEngagementRate}
                  />
                  <MetricCard 
                    title="Content This Week" 
                    value={instagramData.totalContent}
                    lastWeek={instagramData.lastWeekTotalContent.toString()}
                  />
                  <MetricCard 
                    title="Total Views" 
                    value="763"
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
                    value={facebookData.followers.toLocaleString()} 
                    added={facebookData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${facebookData.engagementRate}%`}
                    lastWeek={`${facebookData.lastWeekEngagementRate}%`}
                    showTrend
                    currentValue={facebookData.engagementRate}
                    previousValue={facebookData.lastWeekEngagementRate}
                  />
                  <MetricCard 
                    title="Content This Week" 
                    value={facebookData.totalContent}
                    lastWeek={facebookData.lastWeekTotalContent.toString()}
                  />
                  <MetricCard 
                    title="Total Views" 
                    value="383"
                  />
                </div>
                <div className="overflow-x-auto">
                  {renderFacebookTable()}
                </div>
              </TabsContent>

              <TabsContent value="tiktok">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Total Followers" 
                    value={tiktokData.followers.toLocaleString()} 
                    added={tiktokData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${tiktokData.engagementRate}%`}
                    lastWeek={`${tiktokData.lastWeekEngagementRate}%`}
                    showTrend
                    currentValue={tiktokData.engagementRate}
                    previousValue={tiktokData.lastWeekEngagementRate}
                  />
                  <MetricCard 
                    title="Content This Week" 
                    value={tiktokData.totalContent}
                    lastWeek={tiktokData.lastWeekTotalContent.toString()}
                  />
                  <MetricCard 
                    title="Total Views" 
                    value="1,028"
                  />
                </div>
                <div className="overflow-x-auto">
                  {renderTikTokTable()}
                </div>
              </TabsContent>

              <TabsContent value="x">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <MetricCard 
                    title="Total Followers" 
                    value={xData.followers.toLocaleString()} 
                    added={xData.addedFollowers} 
                  />
                  <MetricCard 
                    title="Engagement Rate" 
                    value={`${xData.engagementRate}%`}
                    lastWeek={`${xData.lastWeekEngagementRate}%`}
                    showTrend
                    currentValue={xData.engagementRate}
                    previousValue={xData.lastWeekEngagementRate}
                  />
                  <MetricCard 
                    title="Content This Week" 
                    value={xData.totalContent}
                    lastWeek={xData.lastWeekTotalContent.toString()}
                  />
                  <MetricCard 
                    title="Total Impressions" 
                    value="239"
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

export default SnarkyPetsDec15to21;
