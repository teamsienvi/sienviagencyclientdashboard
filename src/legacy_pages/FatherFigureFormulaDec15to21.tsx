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

interface LinkedInContent {
  date: string;
  impressions: number;
  membersReached: number;
  profileViewers: number;
  followersGained: number;
  reactions: number;
  comments: number;
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
    link: "https://www.youtube.com/shorts/VwNJKmipUnI",
    views: 574,
    engagementPercent: 8.10,
    platform: "YouTube",
    followers: 75,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 62,
    postTier: "3 (Growth)",
    notes: "Strong emotional hook drove views; engagement depth and conversion signals are the growth constraint."
  },
  {
    link: "https://www.youtube.com/shorts/JS5I6d_plcQ",
    views: 492,
    engagementPercent: 7.6,
    platform: "YouTube",
    followers: 75,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 2,
    conversion: 1,
    totalScore: 61,
    postTier: "3 (Growth)",
    notes: "Consistent reach with similar engagement ceiling; message resonates but needs sharper interaction prompts."
  },
  {
    link: "https://www.instagram.com/reel/DSVdyR9ER-r/",
    views: 569,
    engagementPercent: 5.90,
    platform: "Instagram",
    followers: 828,
    reachTier: "Tier 5",
    engagementTier: "Tier 2",
    influence: 3,
    conversion: 2,
    totalScore: 58,
    postTier: "4 (Presence)",
    notes: "Excellent engagement efficiency for its size, but limited reach"
  }
];

// Instagram Data
const instagramData: PlatformData = {
  followers: 832,
  addedFollowers: 4,
  engagementRate: 24.44,
  lastWeekEngagementRate: 31.36,
  totalContent: 21,
  lastWeekTotalContent: 24
};

// Facebook Data
const facebookData: PlatformData = {
  followers: 219,
  addedFollowers: 36,
  engagementRate: 48.22,
  lastWeekEngagementRate: 59.95,
  totalContent: 23,
  lastWeekTotalContent: 27
};

// TikTok Data
const tiktokData: PlatformData = {
  followers: 406,
  addedFollowers: 4,
  engagementRate: 6.61,
  lastWeekEngagementRate: 9.24,
  totalContent: 20,
  lastWeekTotalContent: 25
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "Monday, Dec 15", views: 171, likes: 6, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Monday, Dec 15", views: 89, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Monday, Dec 15", views: 97, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 16", views: 45, likes: 2, comments: 1, shares: 1, addToFavorites: 1 },
  { type: "Video", date: "Tuesday, Dec 16", views: 90, likes: 2, comments: 1, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Wednesday, Dec 17", views: 97, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 17", views: 98, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 17", views: 66, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 18", views: 100, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 18", views: 88, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 18", views: 104, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 20", views: 74, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 20", views: 121, likes: 3, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 20", views: 130, likes: 4, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Saturday, Dec 20", views: 173, likes: 4, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Saturday, Dec 20", views: 100, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 21", views: 102, likes: 5, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 21", views: 82, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 21", views: 96, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 21", views: 90, likes: 0, comments: 0, shares: 0, addToFavorites: 0 }
];

// X Data
const xData: PlatformData = {
  followers: 57,
  addedFollowers: 3,
  engagementRate: 0,
  lastWeekEngagementRate: 0,
  totalContent: 0,
  lastWeekTotalContent: 0
};

// YouTube Data
const youtubeData: PlatformData = {
  followers: 74,
  addedFollowers: 1,
  engagementRate: 0,
  lastWeekEngagementRate: 0,
  totalContent: 0,
  lastWeekTotalContent: 0
};

// LinkedIn Data
const linkedinData: PlatformData = {
  followers: 35,
  addedFollowers: 3,
  engagementRate: 65.02,
  lastWeekEngagementRate: 68.26,
  totalContent: 23,
  lastWeekTotalContent: 23
};

const linkedinContent: LinkedInContent[] = [
  { date: "Monday, Dec 15", impressions: 10, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Monday, Dec 15", impressions: 7, membersReached: 4, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Monday, Dec 15", impressions: 4, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Tuesday, Dec 16", impressions: 5, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Wednesday, Dec 17", impressions: 7, membersReached: 3, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Wednesday, Dec 17", impressions: 6, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Wednesday, Dec 17", impressions: 6, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 1 },
  { date: "Thursday, Dec 18", impressions: 3, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Thursday, Dec 18", impressions: 2, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Thursday, Dec 18", impressions: 24, membersReached: 15, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Friday, Dec 19", impressions: 73, membersReached: 3, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Friday, Dec 19", impressions: 5, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Friday, Dec 19", impressions: 6, membersReached: 4, profileViewers: 0, followersGained: 0, reactions: 1, comments: 0 },
  { date: "Friday, Dec 19", impressions: 3, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Friday, Dec 19", impressions: 5, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Saturday, Dec 20", impressions: 2, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Saturday, Dec 20", impressions: 1, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Saturday, Dec 20", impressions: 4, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Saturday, Dec 20", impressions: 4, membersReached: 1, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Saturday, Dec 20", impressions: 9, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Saturday, Dec 20", impressions: 6, membersReached: 3, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Sunday, Dec 21", impressions: 7, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 },
  { date: "Sunday, Dec 21", impressions: 4, membersReached: 2, profileViewers: 0, followersGained: 0, reactions: 0, comments: 0 }
];

// Instagram Content
const instagramContent: InstagramContent[] = [
  { type: "Reel", date: "Monday, Dec 15", reach: 145, views: 165, likes: 7, comments: 0, shares: 1, interactions: 8 },
  { type: "Reel", date: "Monday, Dec 15", reach: 157, views: 192, likes: 8, comments: 0, shares: 0, interactions: 8 },
  { type: "Photo", date: "Monday, Dec 15", reach: 7, views: 27, likes: 7, comments: 0, shares: 0, interactions: 7 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 4, views: 18, likes: 7, comments: 0, shares: 0, interactions: 7 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 210, views: 269, likes: 13, comments: 1, shares: 2, interactions: 16 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 107, views: 129, likes: 6, comments: 2, shares: 0, interactions: 8 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 137, views: 164, likes: 8, comments: 1, shares: 0, interactions: 9 },
  { type: "Photo", date: "Wednesday, Dec 17", reach: 8, views: 27, likes: 6, comments: 0, shares: 0, interactions: 6 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 145, views: 161, likes: 8, comments: 1, shares: 0, interactions: 9 },
  { type: "Reel", date: "Thursday, Dec 18", reach: 135, views: 166, likes: 7, comments: 2, shares: 0, interactions: 9 },
  { type: "Photo", date: "Thursday, Dec 18", reach: 10, views: 33, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Carousel", date: "Friday, Dec 19", reach: 44, views: 86, likes: 4, comments: 0, shares: 1, interactions: 5 },
  { type: "Photo", date: "Saturday, Dec 20", reach: 12, views: 21, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 65, views: 73, likes: 2, comments: 0, shares: 0, interactions: 2 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 155, views: 183, likes: 3, comments: 0, shares: 2, interactions: 5 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 112, views: 124, likes: 0, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 183, views: 209, likes: 5, comments: 0, shares: 1, interactions: 6 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 31, views: 37, likes: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 174, views: 211, likes: 3, comments: 0, shares: 1, interactions: 4 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 111, views: 124, likes: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Photo", date: "Sunday, Dec 21", reach: 7, views: 17, likes: 2, comments: 0, shares: 0, interactions: 2 }
];

// Facebook Content
const facebookContent: FacebookContent[] = [
  { type: "Reel", date: "Monday, Dec 15", reach: 20, views: 15, likes: 9, comments: 0, shares: 0, interactions: 9, linkClicks: 0 },
  { type: "Reel", date: "Monday, Dec 15", reach: 17, views: 18, likes: 9, comments: 0, shares: 1, interactions: 10, linkClicks: 0 },
  { type: "Photo", date: "Monday, Dec 15", reach: 25, views: 37, likes: 9, comments: 0, shares: 1, interactions: 10, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 20, views: 33, likes: 9, comments: 0, shares: 3, interactions: 12, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 33, views: 46, likes: 14, comments: 1, shares: 5, interactions: 20, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 16", reach: 20, views: 52, likes: 10, comments: 1, shares: 6, interactions: 17, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 41, views: 74, likes: 12, comments: 1, shares: 13, interactions: 26, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 17", reach: 24, views: 47, likes: 9, comments: 1, shares: 5, interactions: 15, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 17", reach: 78, views: 124, likes: 9, comments: 0, shares: 4, interactions: 13, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 17", reach: 33, views: 73, likes: 12, comments: 2, shares: 9, interactions: 23, linkClicks: 1 },
  { type: "Reel", date: "Thursday, Dec 18", reach: 27, views: 59, likes: 11, comments: 1, shares: 9, interactions: 21, linkClicks: 0 },
  { type: "Photo", date: "Thursday, Dec 18", reach: 35, views: 81, likes: 11, comments: 1, shares: 4, interactions: 16, linkClicks: 0 },
  { type: "Multi media", date: "Friday, Dec 19", reach: 15, views: 29, likes: 4, comments: 1, shares: 13, interactions: 18, linkClicks: 0 },
  { type: "Photo", date: "Saturday, Dec 20", reach: 4, views: 6, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 3, views: 4, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 4, views: 3, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 4, views: 4, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 3, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 20", reach: 5, views: 4, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 2, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 5, views: 5, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 21", reach: 1, views: 2, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sunday, Dec 21", reach: 5, views: 6, likes: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 832, views: 2436, interactions: 114 },
  { platform: "Facebook", followers: 219, views: 580, interactions: 149 },
  { platform: "TikTok", followers: 406, views: 2013, interactions: 38 },
  { platform: "X", followers: 57, views: 0, interactions: 0 },
  { platform: "YouTube", followers: 74, views: 0, interactions: 0 },
  { platform: "LinkedIn", followers: 35, views: 203, interactions: 8 }
];

const FatherFigureFormulaDec15to21 = () => {
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
    a.download = "father_figure_formula_top_posts_dec15-21.csv";
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

  const renderLinkedInTable = () => {
    const filtered = linkedinContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Impressions</TableHead>
            <TableHead>Members Reached</TableHead>
            <TableHead>Profile Viewers</TableHead>
            <TableHead>Followers Gained</TableHead>
            <TableHead>Reactions</TableHead>
            <TableHead>Comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.impressions.toLocaleString()}</TableCell>
              <TableCell>{item.membersReached}</TableCell>
              <TableCell>{item.profileViewers}</TableCell>
              <TableCell>{item.followersGained}</TableCell>
              <TableCell>{item.reactions}</TableCell>
              <TableCell>{item.comments}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderInstagramTable = () => {
    const filtered = instagramContent.filter(item =>
      item.date.toLowerCase().includes(contentSearch.toLowerCase()) ||
      item.type.toLowerCase().includes(contentSearch.toLowerCase())
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
      item.date.toLowerCase().includes(contentSearch.toLowerCase()) ||
      item.type.toLowerCase().includes(contentSearch.toLowerCase())
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
            Father Figure Formula
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

        {/* Platform Content Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-heading">Platform Content Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="instagram" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
                <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
              </TabsList>

              {/* Instagram Tab */}
              <TabsContent value="instagram">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCard 
                    title="Followers" 
                    value={instagramData.followers.toLocaleString()} 
                    added={instagramData.addedFollowers}
                  />
                  <MetricCard 
                    title="Engagement Rate %" 
                    value={`${instagramData.engagementRate}%`}
                    showTrend
                    currentValue={instagramData.engagementRate}
                    previousValue={instagramData.lastWeekEngagementRate}
                    lastWeek={`${instagramData.lastWeekEngagementRate}%`}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={instagramData.totalContent}
                    showTrend
                    currentValue={instagramData.totalContent}
                    previousValue={instagramData.lastWeekTotalContent}
                    lastWeek={`${instagramData.lastWeekTotalContent}`}
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
                  {renderInstagramTable()}
                </div>
              </TabsContent>

              {/* Facebook Tab */}
              <TabsContent value="facebook">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCard 
                    title="Followers" 
                    value={facebookData.followers.toLocaleString()} 
                    added={facebookData.addedFollowers}
                  />
                  <MetricCard 
                    title="Engagement Rate %" 
                    value={`${facebookData.engagementRate}%`}
                    showTrend
                    currentValue={facebookData.engagementRate}
                    previousValue={facebookData.lastWeekEngagementRate}
                    lastWeek={`${facebookData.lastWeekEngagementRate}%`}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={facebookData.totalContent}
                    showTrend
                    currentValue={facebookData.totalContent}
                    previousValue={facebookData.lastWeekTotalContent}
                    lastWeek={`${facebookData.lastWeekTotalContent}`}
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
                  {renderFacebookTable()}
                </div>
              </TabsContent>

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
                    value={`${tiktokData.engagementRate}%`}
                    showTrend
                    currentValue={tiktokData.engagementRate}
                    previousValue={tiktokData.lastWeekEngagementRate}
                    lastWeek={`${tiktokData.lastWeekEngagementRate}%`}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={tiktokData.totalContent}
                    showTrend
                    currentValue={tiktokData.totalContent}
                    previousValue={tiktokData.lastWeekTotalContent}
                    lastWeek={`${tiktokData.lastWeekTotalContent}`}
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

              {/* LinkedIn Tab */}
              <TabsContent value="linkedin">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCard 
                    title="Followers" 
                    value={linkedinData.followers.toLocaleString()} 
                    added={linkedinData.addedFollowers}
                  />
                  <MetricCard 
                    title="Impressions Rate" 
                    value={`${linkedinData.engagementRate}%`}
                    showTrend
                    currentValue={linkedinData.engagementRate}
                    previousValue={linkedinData.lastWeekEngagementRate}
                    lastWeek={`${linkedinData.lastWeekEngagementRate}%`}
                  />
                  <MetricCard 
                    title="Total Content" 
                    value={linkedinData.totalContent}
                    showTrend
                    currentValue={linkedinData.totalContent}
                    previousValue={linkedinData.lastWeekTotalContent}
                    lastWeek={`${linkedinData.lastWeekTotalContent}`}
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
                  {renderLinkedInTable()}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FatherFigureFormulaDec15to21;
