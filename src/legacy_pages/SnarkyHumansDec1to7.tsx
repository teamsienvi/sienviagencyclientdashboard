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
  likesReactions: number;
  comments: number;
  shares: number;
  interactions: number;
}

interface FacebookContent {
  type: string;
  date: string;
  reach: number;
  views: number;
  likesReactions: number;
  comments: number;
  shares: number;
  interactions: number;
  linkClicks: number;
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
  type: string;
  date: string;
  impressions: number;
  engagements: number;
  profileVisits: number;
  linkClicks: number;
}

interface YouTubeContent {
  title: string;
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
  addedFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
  totalContent: number;
  lastWeekTotalContent: number;
}

const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.youtube.com/watch?v=NrgTAsZeHU0",
    views: 1082,
    engagementPercent: 12.68,
    platform: "Youtube",
    followers: 5,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 77,
    postTier: "Tier 2 (Influence)",
    notes: "High engagement; humor-driven posts are strongly resonating"
  },
  {
    link: "https://www.youtube.com/watch?v=ix_1jUsH5aQ",
    views: 887,
    engagementPercent: 8.10,
    platform: "Youtube",
    followers: 5,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 49,
    postTier: "4 (Presence)",
    notes: "Visibility is decent and decent engagement"
  },
  {
    link: "https://www.tiktok.com/@headsnarky69/video/7580748136604273975",
    views: 305,
    engagementPercent: 5.68,
    platform: "TikTok",
    followers: 17455,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 3,
    conversion: 3,
    totalScore: 44,
    postTier: "4 (Presence)",
    notes: "Reach is modest and engagement minimal"
  }
];

const instagramData: PlatformData = {
  followers: 51,
  addedFollowers: 1,
  engagementRate: 18.49,
  lastWeekEngagementRate: 18.21,
  totalContent: 21,
  lastWeekTotalContent: 24
};

const instagramContent: InstagramContent[] = [
  { type: "Photo", date: "Monday, Dec 1", reach: 3, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Monday, Dec 1", reach: 7, views: 105, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Monday, Dec 1", reach: 1, views: 38, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 113, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 59, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 100, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: "No data", views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 7, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 103, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Thursday, Dec 4", reach: 1, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Thursday, Dec 4", reach: "No data", views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Friday, Dec 5", reach: "No data", views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: "No data", views: 108, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: "No data", views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Saturday, Dec 6", reach: "No data", views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: "No data", views: 123, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: "No data", views: 102, likesReactions: 2, comments: 0, shares: 1, interactions: 3 },
  { type: "Reel", date: "Saturday, Dec 6", reach: "No data", views: 141, likesReactions: 1, comments: 0, shares: 0, interactions: 2 },
  { type: "Photo", date: "Sunday, Dec 7", reach: 36, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 97, views: 11, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: "No data", views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0 }
];

const facebookData: PlatformData = {
  followers: 1297,
  addedFollowers: 3,
  engagementRate: 32.00,
  lastWeekEngagementRate: 31.52,
  totalContent: 23,
  lastWeekTotalContent: 26
};

const facebookContent: FacebookContent[] = [
  { type: "Photo", date: "Monday, Dec 1", reach: 5, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Monday, Dec 1", reach: 5, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Monday, Dec 1", reach: 4, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 4, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 1 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 4, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 2, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 48, views: 40, likesReactions: 2, comments: 0, shares: 0, interactions: 2, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 5, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 3, views: 4, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 6, views: 9, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 7, views: 9, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Thursday, Dec 4", reach: 7, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Thursday, Dec 4", reach: 8, views: 12, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Friday, Dec 5", reach: 1, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 2, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 3, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Saturday, Dec 6", reach: 5, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 6, views: 12, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 5, views: 9, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 11, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sunday, Dec 7", reach: 2, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 3, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 3, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

const tiktokData: PlatformData = {
  followers: 17409,
  addedFollowers: 0,
  engagementRate: 8.82,
  lastWeekEngagementRate: 8.61,
  totalContent: 22,
  lastWeekTotalContent: 20
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "Monday, Dec 1", views: 2, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 2", views: 18, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 2", views: 7, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 2", views: 87, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 2", views: 15, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 3", views: 33, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 3", views: 91, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 3", views: 50, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 3", views: 75, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 78, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 97, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 29, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 33, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 291, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 111, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 305, likes: 3, comments: 0, shares: 0, addToFavorites: 2 },
  { type: "Video", date: "Saturday, Dec 6", views: 63, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 116, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 24, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 7", views: 283, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 7", views: 4, likes: 4, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 7", views: 93, likes: 0, comments: 0, shares: 0, addToFavorites: 0 }
];

const xData: PlatformData = {
  followers: 37,
  addedFollowers: 1,
  engagementRate: 58.57,
  lastWeekEngagementRate: 50.60,
  totalContent: 25,
  lastWeekTotalContent: 17
};

const xContent: XContent[] = [
  { type: "Post", date: "Monday, Dec 1", impressions: 8, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Monday, Dec 1", impressions: 15, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 8, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 10, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 8, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 45, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 6, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 43, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 7, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 10, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 22, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 10, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 10, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 31, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 14, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 7, engagements: 4, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 4, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 7, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 5, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 0, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 3, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 2, engagements: 2, profileVisits: 0, linkClicks: 0 }
];

const youtubeData: PlatformData = {
  followers: 5,
  addedFollowers: 3,
  engagementRate: 7.91,
  lastWeekEngagementRate: 6.31,
  totalContent: 13,
  lastWeekTotalContent: 11
};

const youtubeContent: YouTubeContent[] = [
  { title: "POV: Negotiating with a Tiny Dictator Over Chicken Nuggets", date: "Monday, Dec 1", duration: 11, likes: 0, comments: 0, shares: 0, views: 166, subscribers: 0, impressions: 34 },
  { title: "The Mug Every Blanket Thief Deserves", date: "Tuesday, Dec 2", duration: 18, likes: 0, comments: 0, shares: 0, views: 115, subscribers: 0, impressions: 14 },
  { title: "I'm not lazy, I'm just buffering", date: "Tuesday, Dec 2", duration: 11, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 5 },
  { title: "The Perfect Gift for Your Favorite Blanket Thief", date: "Tuesday, Dec 2", duration: 18, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 8 },
  { title: "POV: You're raising future legends", date: "Wednesday, Dec 3", duration: 11, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 1 },
  { title: "Let the hat do the talking", date: "Friday, Dec 5", duration: 11, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 12 },
  { title: "I Don't Throw Hands, I Throw SHADE", date: "Saturday, Dec 6", duration: 11, likes: 0, comments: 0, shares: 0, views: 290, subscribers: 0, impressions: 5 },
  { title: "Bad Hair Day? Nah… It's a BAD PEOPLE Day", date: "Saturday, Dec 6", duration: 13, likes: 1, comments: 0, shares: 0, views: 887, subscribers: 0, impressions: 1 },
  { title: "This 'Easy' Try Not To Laugh Challenge Made EVERYONE Fail", date: "Saturday, Dec 6", duration: 18, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 1 },
  { title: "WARNING: This Mug Spills TRUTH and Sarcasm", date: "Saturday, Dec 6", duration: 16, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 1 },
  { title: "That Grandpa Smile Right Before He Says Something WILDLY Inappropriate", date: "Sunday, Dec 7", duration: 11, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 3 },
  { title: "POV: You're Manifesting Clarity While Narrating Your Own Downfall in HD", date: "Sunday, Dec 7", duration: 69, likes: 13, comments: 0, shares: 2, views: 1082, subscribers: 0, impressions: 0 },
  { title: "Too Cool to Care, Too Warm to Leave", date: "Sunday, Dec 7", duration: 21, likes: 0, comments: 0, shares: 0, views: 15, subscribers: 0, impressions: 0 }
];

const chartData = [
  { platform: "Instagram", followers: 51, views: 652, interactions: 5 },
  { platform: "Facebook", followers: 1297, views: 151, interactions: 2 },
  { platform: "TikTok", followers: 17409, views: 1525, interactions: 8 },
  { platform: "X", followers: 37, views: 280, interactions: 82 },
  { platform: "YouTube", followers: 5, views: 2555, interactions: 16 }
];

const SnarkyHumansDec1to7 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [contentFilter, setContentFilter] = useState("All");

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
    a.download = "snarky_humans_top_posts_dec1-7.csv";
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
    const filtered = instagramContent.filter(item => {
      const matchesSearch = item.date.toLowerCase().includes(contentSearch.toLowerCase());
      const matchesFilter = contentFilter === "All" || 
        (contentFilter === "Reel" && item.type === "Reel") ||
        (contentFilter === "Post" && item.type === "Photo");
      return matchesSearch && matchesFilter;
    });

    return (
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
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant={item.type === "Reel" ? "default" : "secondary"}>
                  {item.type}
                </Badge>
              </TableCell>
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
      const matchesFilter = contentFilter === "All" || 
        (contentFilter === "Reel" && item.type === "Reel") ||
        (contentFilter === "Post" && item.type === "Photo");
      return matchesSearch && matchesFilter;
    });

    return (
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
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant={item.type === "Reel" ? "default" : "secondary"}>
                  {item.type}
                </Badge>
              </TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.reach.toLocaleString()}</TableCell>
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
            <TableHead>Type</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Impressions</TableHead>
            <TableHead>Engagements</TableHead>
            <TableHead>Profile Visits</TableHead>
            <TableHead>Link Clicks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Badge variant="secondary">{item.type}</Badge>
              </TableCell>
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
    const filtered = youtubeContent.filter(item =>
      item.title.toLowerCase().includes(contentSearch.toLowerCase()) ||
      item.date.toLowerCase().includes(contentSearch.toLowerCase())
    );

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Title</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Duration (s)</TableHead>
            <TableHead>Views</TableHead>
            <TableHead>Likes</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead>Shares</TableHead>
            <TableHead>Subscribers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium max-w-[300px] truncate" title={item.title}>
                {item.title}
              </TableCell>
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
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Clients</span>
          </Link>

          <div className="mb-8 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Snarky Humans</h1>
                <p className="text-muted-foreground text-lg">Weekly Performance Insights (Dec 1-7)</p>
              </div>
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Activity className="h-4 w-4" />
                Live Data
              </Button>
            </div>
          </div>

          {/* Top Performing Insights */}
          <Card className="mb-8 animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-2xl font-heading">Top Performing Insights</CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={topPostsSearch}
                    onChange={(e) => setTopPostsSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button variant="outline" onClick={exportTopPostsCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Engagement %</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Reach Tier
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
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
                          <TooltipTrigger>
                            <Info className="h-3 w-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Tier 1: 8%+</p>
                            <p>Tier 2: 5-8%</p>
                            <p>Tier 3: 3-5%</p>
                            <p>Tier 4: 1-3%</p>
                            <p>Tier 5: &lt;1%</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableHead>
                    <TableHead>Influence</TableHead>
                    <TableHead>Total Score</TableHead>
                    <TableHead>Post Tier</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPosts.map((post, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>{post.views.toLocaleString()}</TableCell>
                      <TableCell>{post.engagementPercent}%</TableCell>
                      <TableCell>
                        <Badge variant="outline">{post.platform}</Badge>
                      </TableCell>
                      <TableCell>{post.followers.toLocaleString()}</TableCell>
                      <TableCell>{post.reachTier}</TableCell>
                      <TableCell>{post.engagementTier}</TableCell>
                      <TableCell>{post.influence}</TableCell>
                      <TableCell>{post.totalScore}</TableCell>
                      <TableCell>{post.postTier}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={post.notes}>{post.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Platform Performance Overview Chart */}
          <Card className="mb-8 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl font-heading">Platform Performance Overview</CardTitle>
            </CardHeader>
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

          {/* Platform Content Performance */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl font-heading">Platform Content Performance</CardTitle>
            </CardHeader>
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
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${instagramData.engagementRate}%`} 
                      lastWeek={`${instagramData.lastWeekEngagementRate}%`}
                      showTrend={true}
                      currentValue={instagramData.engagementRate}
                      previousValue={instagramData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={instagramData.totalContent} 
                      lastWeek={String(instagramData.lastWeekTotalContent)}
                      showTrend={true}
                      currentValue={instagramData.totalContent}
                      previousValue={instagramData.lastWeekTotalContent}
                    />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      {["All", "Reel", "Post"].map((filter) => (
                        <Button
                          key={filter}
                          variant={contentFilter === filter ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContentFilter(filter)}
                        >
                          {filter}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {renderInstagramTable()}
                </TabsContent>

                <TabsContent value="facebook">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={facebookData.followers.toLocaleString()} added={facebookData.addedFollowers} />
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${facebookData.engagementRate}%`} 
                      lastWeek={`${facebookData.lastWeekEngagementRate}%`}
                      showTrend={true}
                      currentValue={facebookData.engagementRate}
                      previousValue={facebookData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={facebookData.totalContent} 
                      lastWeek={String(facebookData.lastWeekTotalContent)}
                      showTrend={true}
                      currentValue={facebookData.totalContent}
                      previousValue={facebookData.lastWeekTotalContent}
                    />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      {["All", "Reel", "Post"].map((filter) => (
                        <Button
                          key={filter}
                          variant={contentFilter === filter ? "default" : "outline"}
                          size="sm"
                          onClick={() => setContentFilter(filter)}
                        >
                          {filter}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {renderFacebookTable()}
                </TabsContent>

                <TabsContent value="tiktok">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={tiktokData.followers.toLocaleString()} added={tiktokData.addedFollowers} />
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${tiktokData.engagementRate}%`} 
                      lastWeek={`${tiktokData.lastWeekEngagementRate}%`}
                      showTrend={true}
                      currentValue={tiktokData.engagementRate}
                      previousValue={tiktokData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={tiktokData.totalContent} 
                      lastWeek={String(tiktokData.lastWeekTotalContent)}
                      showTrend={true}
                      currentValue={tiktokData.totalContent}
                      previousValue={tiktokData.lastWeekTotalContent}
                    />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  {renderTikTokTable()}
                </TabsContent>

                <TabsContent value="x">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={xData.followers} added={xData.addedFollowers} />
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${xData.engagementRate}%`} 
                      lastWeek={`${xData.lastWeekEngagementRate}%`}
                      showTrend={true}
                      currentValue={xData.engagementRate}
                      previousValue={xData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={xData.totalContent} 
                      lastWeek={String(xData.lastWeekTotalContent)}
                      showTrend={true}
                      currentValue={xData.totalContent}
                      previousValue={xData.lastWeekTotalContent}
                    />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  {renderXTable()}
                </TabsContent>

                <TabsContent value="youtube">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Followers" value={youtubeData.followers} added={youtubeData.addedFollowers} />
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${youtubeData.engagementRate}%`} 
                      lastWeek={`${youtubeData.lastWeekEngagementRate}%`}
                      showTrend={true}
                      currentValue={youtubeData.engagementRate}
                      previousValue={youtubeData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={youtubeData.totalContent} 
                      lastWeek={String(youtubeData.lastWeekTotalContent)}
                      showTrend={true}
                      currentValue={youtubeData.totalContent}
                      previousValue={youtubeData.lastWeekTotalContent}
                    />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        value={contentSearch}
                        onChange={(e) => setContentSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
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

export default SnarkyHumansDec1to7;
