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

interface InstagramContent {
  type: string;
  date: string;
  reach: string | number;
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

// Data from CSV - Snarky Humans Nov 24-30
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.youtube.com/watch?v=OmjtstDFqXg",
    views: 1460,
    engagementPercent: 4.40,
    platform: "Youtube",
    followers: 49,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 3,
    conversion: 3,
    totalScore: 55,
    postTier: "3 (Growth)",
    notes: "Strong reach relative to others, but engagement is low"
  },
  {
    link: "https://www.youtube.com/watch?v=SvrjV58PF1A",
    views: 976,
    engagementPercent: 3.40,
    platform: "Youtube",
    followers: 49,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 3,
    conversion: 3,
    totalScore: 48,
    postTier: "4 (Presence)",
    notes: "Visibility is decent but very low engagement"
  },
  {
    link: "https://www.instagram.com/reel/DRm3hKIkf79/",
    views: 881,
    engagementPercent: 3.18,
    platform: "Instagram",
    followers: 50,
    reachTier: "Tier 5",
    engagementTier: "Tier 3",
    influence: 3,
    conversion: 3,
    totalScore: 47,
    postTier: "4 (Presence)",
    notes: "Minimal engagement for this reach"
  }
];

const instagramData: PlatformData = {
  followers: 50,
  addedFollowers: 1,
  engagementRate: 18.21,
  lastWeekEngagementRate: 29.36,
  totalContent: 24,
  lastWeekTotalContent: 24
};

const instagramContent: InstagramContent[] = [
  { type: "Post", date: "Monday, Nov 24", reach: "No data", views: 8, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Post", date: "Tuesday, Nov 25", reach: 1, views: 4, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Tuesday, Nov 25", reach: 6, views: 6, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 19, views: 24, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 102, views: 111, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Post", date: "Wednesday, Nov 26", reach: "No data", views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 134, views: 143, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Thursday, Nov 27", reach: 103, views: 122, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Post", date: "Thursday, Nov 27", reach: "No data", views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Thursday, Nov 27", reach: 109, views: 128, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Nov 28", reach: 634, views: 881, likesReactions: 27, comments: 0, shares: 0, interactions: 28 },
  { type: "Post", date: "Friday, Nov 28", reach: 1, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Post", date: "Friday, Nov 28", reach: "No data", views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Nov 28", reach: 78, views: 89, likesReactions: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Friday, Nov 28", reach: 84, views: 95, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 102, views: 109, likesReactions: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Post", date: "Saturday, Nov 29", reach: 1, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 78, views: 89, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 108, views: 118, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 21, views: 21, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 108, views: 116, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 102, views: 117, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Post", date: "Sunday, Nov 30", reach: "No data", views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 12, views: 13, likesReactions: 0, comments: 0, shares: 0, interactions: 0 }
];

const facebookData: PlatformData = {
  followers: 1294,
  addedFollowers: 1,
  engagementRate: 31.52,
  lastWeekEngagementRate: 48.62,
  totalContent: 26,
  lastWeekTotalContent: 22
};

const facebookContent: FacebookContent[] = [
  { type: "Reel", date: "Monday, Nov 24", reach: 6, views: 0, likesReactions: 2, comments: 0, shares: 0, interactions: 2, linkClicks: 0 },
  { type: "Reel", date: "Monday, Nov 24", reach: 7, views: 0, likesReactions: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Photo Post", date: "Monday, Nov 24", reach: 9, views: 17, likesReactions: 2, comments: 0, shares: 0, interactions: 2, linkClicks: 0 },
  { type: "Photo Post", date: "Tuesday, Nov 25", reach: 5, views: 6, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Nov 25", reach: 9, views: 10, likesReactions: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 10, views: 11, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 1 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 3, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo Post", date: "Wednesday, Nov 26", reach: 4, views: 8, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Nov 26", reach: 8, views: 50, likesReactions: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Thursday, Nov 27", reach: 20, views: 18, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo Post", date: "Thursday, Nov 27", reach: 6, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Thursday, Nov 27", reach: 5, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Friday, Nov 28", reach: 5, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo Post", date: "Friday, Nov 28", reach: 3, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo Post", date: "Friday, Nov 28", reach: 3, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Friday, Nov 28", reach: 6, views: 3, likesReactions: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Friday, Nov 28", reach: 5, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 7, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo Post", date: "Saturday, Nov 29", reach: 7, views: 9, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 8, views: 5, likesReactions: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Nov 29", reach: 13, views: 12, likesReactions: 1, comments: 0, shares: 0, interactions: 1, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 2, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 3, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 2, views: 1, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo Post", date: "Sunday, Nov 30", reach: 5, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Nov 30", reach: 6, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

const tiktokData: PlatformData = {
  followers: 17432,
  addedFollowers: 0,
  engagementRate: 8.61,
  lastWeekEngagementRate: 7.49,
  totalContent: 20,
  lastWeekTotalContent: 15
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "Monday, Nov 24", views: 43, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Monday, Nov 24", views: 89, likes: 9, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Nov 25", views: 99, likes: 1, comments: 1, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Nov 25", views: 103, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Nov 25", views: 51, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Nov 25", views: 35, likes: 1, comments: 1, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Nov 26", views: 35, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Nov 26", views: 96, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Nov 26", views: 15, likes: 1, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Thursday, Nov 27", views: 113, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Nov 27", views: 96, likes: 0, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Friday, Nov 28", views: 9, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Nov 28", views: 81, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Nov 28", views: 41, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Nov 29", views: 49, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Nov 29", views: 31, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Nov 29", views: 38, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Nov 29", views: 3, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Nov 30", views: 29, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Nov 30", views: 44, likes: 1, comments: 0, shares: 0, addToFavorites: 0 }
];

const xData: PlatformData = {
  followers: 36,
  addedFollowers: 0,
  engagementRate: 50.60,
  lastWeekEngagementRate: 38.33,
  totalContent: 17,
  lastWeekTotalContent: 20
};

const xContent: XContent[] = [
  { type: "Post", date: "Monday, Nov 24", impressions: 12, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Nov 25", impressions: 17, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Nov 25", impressions: 10, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Nov 25", impressions: 10, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Tuesday, Nov 25", impressions: 10, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Wednesday, Nov 26", impressions: 15, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Nov 27", impressions: 14, engagements: 7, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Thursday, Nov 27", impressions: 13, engagements: 8, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Nov 28", impressions: 8, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Nov 28", impressions: 8, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Nov 28", impressions: 6, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Friday, Nov 28", impressions: 18, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Nov 29", impressions: 3, engagements: 3, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Saturday, Nov 29", impressions: 7, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Nov 30", impressions: 1, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Nov 30", impressions: 4, engagements: 2, profileVisits: 0, linkClicks: 0 },
  { type: "Post", date: "Sunday, Nov 30", impressions: 10, engagements: 2, profileVisits: 0, linkClicks: 0 }
];

const youtubeData: PlatformData = {
  followers: 2,
  addedFollowers: 0,
  engagementRate: 6.31,
  lastWeekEngagementRate: 0,
  totalContent: 11,
  lastWeekTotalContent: 0
};

const youtubeContent: YouTubeContent[] = [
  { title: "Every Friendship Has THAT ONE… Which One Are You? 😂☕ | Snarky Human Gifts", date: "Thursday, Nov 27", duration: 8, likes: 1, comments: 0, shares: 0, views: 88, subscribers: 0, impressions: 7 },
  { title: "Privacy? What Privacy?! 😂 Moms, You Know This Struggle! 🚽👶 | Snarky Human Water Bottle", date: "Thursday, Nov 27", duration: 11, likes: 0, comments: 0, shares: 0, views: 97, subscribers: 1, impressions: 71 },
  { title: "Karen Strikes Again! 😂 Ranking the MOST Outrageous Karen Moments Ever", date: "Friday, Nov 28", duration: 61, likes: 0, comments: 0, shares: 0, views: 3, subscribers: 0, impressions: 31 },
  { title: "I'm Not Lazy… I'm Just Buffering 😂☕ | Snarky Human Travel Mug", date: "Friday, Nov 28", duration: 11, likes: 0, comments: 0, shares: 0, views: 29, subscribers: 0, impressions: 6 },
  { title: "When You're Too Done to Talk… Let Your Hat Speak 😎🧢 | Snarky Human Snapback", date: "Friday, Nov 28", duration: 11, likes: 0, comments: 0, shares: 0, views: 30, subscribers: 0, impressions: 12 },
  { title: "Friendship Powered by Chaos & Wine 😂💅 | Snarky Humans Bestie Tee", date: "Saturday, Nov 29", duration: 14, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0, impressions: 8 },
  { title: "I'm Not Cold… I'm Freezing My Attitude ❄️💅 | Snarky Humans Sarcastic Jacket", date: "Saturday, Nov 29", duration: 26, likes: 8, comments: 0, shares: 0, views: 1460, subscribers: 0, impressions: 26 },
  { title: "Not Our Mug… But Definitely Our Vibe 😂☕ | Snarky Humans Coffee Mugs", date: "Saturday, Nov 29", duration: 39, likes: 2, comments: 0, shares: 0, views: 976, subscribers: 0, impressions: 20 },
  { title: "Warm Outside, Cold-Hearted Inside 🧥💀 | Snarky Humans Sarcastic Jacket", date: "Saturday, Nov 29", duration: 27, likes: 0, comments: 0, shares: 0, views: 248, subscribers: 0, impressions: 5 },
  { title: "Not Lazy… Just Efficient ⚡😴 | Snarky Humans Energy Saver Tee", date: "Sunday, Nov 30", duration: 10, likes: 0, comments: 0, shares: 0, views: 163, subscribers: 0, impressions: 0 },
  { title: "When 'I Love You, Dad' Isn't Enough… 😂💛 | Snarky Humans Sarcastic Cards", date: "Sunday, Nov 30", duration: 14, likes: 0, comments: 0, shares: 0, views: 61, subscribers: 0, impressions: 1 }
];

// Chart data
const chartData = [
  {
    platform: "Instagram",
    followers: 50,
    views: 2196,
    interactions: 30
  },
  {
    platform: "Facebook",
    followers: 1294,
    views: 185,
    interactions: 10
  },
  {
    platform: "TikTok",
    followers: 17432,
    views: 1100,
    interactions: 18
  },
  {
    platform: "X",
    followers: 36,
    views: 166,
    interactions: 84
  },
  {
    platform: "YouTube",
    followers: 2,
    views: 3156,
    interactions: 11
  }
];

const SnarkyHumansNov24to30 = () => {
  const [topPostsSearch, setTopPostsSearch] = useState("");
  const [instagramSearch, setInstagramSearch] = useState("");
  const [facebookSearch, setFacebookSearch] = useState("");
  const [tiktokSearch, setTiktokSearch] = useState("");
  const [xSearch, setXSearch] = useState("");
  const [youtubeSearch, setYoutubeSearch] = useState("");
  const [instagramFilter, setInstagramFilter] = useState("All");
  const [facebookFilter, setFacebookFilter] = useState("All");

  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
  };

  const filteredTopPosts = topPerformingPosts.filter(post =>
    post.link.toLowerCase().includes(topPostsSearch.toLowerCase()) ||
    post.platform.toLowerCase().includes(topPostsSearch.toLowerCase())
  );

  const filteredInstagramContent = instagramContent.filter(content => {
    const matchesSearch = content.date.toLowerCase().includes(instagramSearch.toLowerCase());
    const matchesFilter = instagramFilter === "All" || content.type === instagramFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredFacebookContent = facebookContent.filter(content => {
    const matchesSearch = content.date.toLowerCase().includes(facebookSearch.toLowerCase());
    const matchesFilter = facebookFilter === "All" || content.type.includes(facebookFilter);
    return matchesSearch && matchesFilter;
  });

  const filteredTiktokContent = tiktokContent.filter(content =>
    content.date.toLowerCase().includes(tiktokSearch.toLowerCase())
  );

  const filteredXContent = xContent.filter(content =>
    content.date.toLowerCase().includes(xSearch.toLowerCase())
  );

  const filteredYoutubeContent = youtubeContent.filter(content =>
    content.title.toLowerCase().includes(youtubeSearch.toLowerCase()) ||
    content.date.toLowerCase().includes(youtubeSearch.toLowerCase())
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTrendIndicator = (current: number, previous: number) => {
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
        <Header />

        <main className="container mx-auto px-6 py-8">
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Clients</span>
          </Link>

          {/* Client Info */}
          <div className="mb-8 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Snarky Humans</h1>
                <p className="text-muted-foreground">Weekly Performance Insights (Nov 24 - 30)</p>
              </div>
              <Button className="bg-primary hover:bg-primary/90">
                <Activity className="mr-2 h-4 w-4" />
                Live Data
              </Button>
            </div>
          </div>

          {/* Top Performing Insights */}
          <Card className="mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Top Performing Insights</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search posts..."
                      className="pl-10 w-64"
                      value={topPostsSearch}
                      onChange={(e) => setTopPostsSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => exportToCSV(topPerformingPosts, "top-performing-posts")}>
                    <Download className="mr-2 h-4 w-4" />
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
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Reach Tier Definitions:</p>
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
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Engagement Tier Definitions:</p>
                              <p>Tier 1: 8%+ engagement rate</p>
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
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Influence (1-5 Scale):</p>
                              <p>Quality of interactions: mentions from authority accounts, shares by influencers, media pickups</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Conversion
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Conversion (1-5 Scale):</p>
                              <p>Click-throughs, DM inquiries, newsletter signups, purchases</p>
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
                        <TableCell>{post.engagementPercent}%</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{post.platform}</Badge>
                        </TableCell>
                        <TableCell>{post.followers.toLocaleString()}</TableCell>
                        <TableCell>{post.reachTier}</TableCell>
                        <TableCell>{post.engagementTier}</TableCell>
                        <TableCell>{post.influence}</TableCell>
                        <TableCell>{post.conversion}</TableCell>
                        <TableCell className="font-semibold">{post.totalScore}</TableCell>
                        <TableCell>{post.postTier}</TableCell>
                        <TableCell className="max-w-xs truncate">{post.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Platform Performance Overview Chart */}
          <Card className="mb-8 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <CardTitle className="text-xl">Platform Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="platform" className="text-muted-foreground" />
                  <YAxis className="text-muted-foreground" />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="followers" name="Followers" fill="hsl(var(--primary))" />
                  <Bar dataKey="views" name="Total Views" fill="hsl(var(--primary) / 0.6)" />
                  <Bar dataKey="interactions" name="Total Interactions" fill="hsl(var(--primary) / 0.3)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform Content Performance */}
          <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
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
                <TabsContent value="instagram">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold text-foreground">{instagramData.followers.toLocaleString()}</p>
                          {instagramData.addedFollowers > 0 && (
                            <p className="text-sm text-green-500">+{instagramData.addedFollowers} new</p>
                          )}
                          {instagramData.addedFollowers === 0 && (
                            <p className="text-sm text-muted-foreground">0 new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Engagement Rate</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{instagramData.engagementRate}%</p>
                            {renderTrendIndicator(instagramData.engagementRate, instagramData.lastWeekEngagementRate)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {instagramData.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{instagramData.totalContent}</p>
                            {renderTrendIndicator(instagramData.totalContent, instagramData.lastWeekTotalContent)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {instagramData.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        className="pl-10"
                        value={instagramSearch}
                        onChange={(e) => setInstagramSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      {["All", "Reel", "Post"].map((filter) => (
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
                    <Button variant="outline" onClick={() => exportToCSV(instagramContent, "instagram-content")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
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
                            <TableCell>{content.likesReactions}</TableCell>
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
                <TabsContent value="facebook">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold text-foreground">{facebookData.followers.toLocaleString()}</p>
                          {facebookData.addedFollowers > 0 && (
                            <p className="text-sm text-green-500">+{facebookData.addedFollowers} new</p>
                          )}
                          {facebookData.addedFollowers === 0 && (
                            <p className="text-sm text-muted-foreground">0 new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Engagement Rate</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{facebookData.engagementRate}%</p>
                            {renderTrendIndicator(facebookData.engagementRate, facebookData.lastWeekEngagementRate)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {facebookData.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{facebookData.totalContent}</p>
                            {renderTrendIndicator(facebookData.totalContent, facebookData.lastWeekTotalContent)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {facebookData.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        className="pl-10"
                        value={facebookSearch}
                        onChange={(e) => setFacebookSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      {["All", "Reel", "Photo Post"].map((filter) => (
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
                    <Button variant="outline" onClick={() => exportToCSV(facebookContent, "facebook-content")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
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
                            <TableCell>{content.likesReactions}</TableCell>
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
                <TabsContent value="tiktok">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold text-foreground">{tiktokData.followers.toLocaleString()}</p>
                          {tiktokData.addedFollowers > 0 && (
                            <p className="text-sm text-green-500">+{tiktokData.addedFollowers} new</p>
                          )}
                          {tiktokData.addedFollowers === 0 && (
                            <p className="text-sm text-muted-foreground">0 new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Engagement Rate</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{tiktokData.engagementRate}%</p>
                            {renderTrendIndicator(tiktokData.engagementRate, tiktokData.lastWeekEngagementRate)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {tiktokData.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{tiktokData.totalContent}</p>
                            {renderTrendIndicator(tiktokData.totalContent, tiktokData.lastWeekTotalContent)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {tiktokData.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        className="pl-10"
                        value={tiktokSearch}
                        onChange={(e) => setTiktokSearch(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" onClick={() => exportToCSV(tiktokContent, "tiktok-content")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
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
                        {filteredTiktokContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant="default">{content.type}</Badge>
                            </TableCell>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.views}</TableCell>
                            <TableCell>{content.likes}</TableCell>
                            <TableCell>{content.comments}</TableCell>
                            <TableCell>{content.shares}</TableCell>
                            <TableCell>{content.addToFavorites}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* X Tab */}
                <TabsContent value="x">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Followers</p>
                          <p className="text-3xl font-bold text-foreground">{xData.followers.toLocaleString()}</p>
                          {xData.addedFollowers > 0 && (
                            <p className="text-sm text-green-500">+{xData.addedFollowers} new</p>
                          )}
                          {xData.addedFollowers === 0 && (
                            <p className="text-sm text-muted-foreground">0 new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Engagement Rate</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{xData.engagementRate}%</p>
                            {renderTrendIndicator(xData.engagementRate, xData.lastWeekEngagementRate)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {xData.lastWeekEngagementRate}%</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{xData.totalContent}</p>
                            {renderTrendIndicator(xData.totalContent, xData.lastWeekTotalContent)}
                          </div>
                          <p className="text-sm text-muted-foreground">Last week: {xData.lastWeekTotalContent}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search content..."
                        className="pl-10"
                        value={xSearch}
                        onChange={(e) => setXSearch(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" onClick={() => exportToCSV(xContent, "x-content")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
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
                        {filteredXContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant="secondary">{content.type}</Badge>
                            </TableCell>
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
                <TabsContent value="youtube">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Subscribers</p>
                          <p className="text-3xl font-bold text-foreground">{youtubeData.followers.toLocaleString()}</p>
                          {youtubeData.addedFollowers > 0 && (
                            <p className="text-sm text-green-500">+{youtubeData.addedFollowers} new</p>
                          )}
                          {youtubeData.addedFollowers === 0 && (
                            <p className="text-sm text-muted-foreground">0 new</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Engagement Rate</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{youtubeData.engagementRate}%</p>
                            {youtubeData.lastWeekEngagementRate > 0 && renderTrendIndicator(youtubeData.engagementRate, youtubeData.lastWeekEngagementRate)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Last week: {youtubeData.lastWeekEngagementRate > 0 ? `${youtubeData.lastWeekEngagementRate}%` : "N/A"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Total Content</p>
                          <div className="flex items-center justify-center gap-2">
                            <p className="text-3xl font-bold text-foreground">{youtubeData.totalContent}</p>
                            {youtubeData.lastWeekTotalContent > 0 && renderTrendIndicator(youtubeData.totalContent, youtubeData.lastWeekTotalContent)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Last week: {youtubeData.lastWeekTotalContent > 0 ? youtubeData.lastWeekTotalContent : "N/A"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search videos..."
                        className="pl-10"
                        value={youtubeSearch}
                        onChange={(e) => setYoutubeSearch(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" onClick={() => exportToCSV(youtubeContent, "youtube-content")}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Duration (s)</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Likes</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Subscribers</TableHead>
                          <TableHead>Impressions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredYoutubeContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell className="max-w-xs truncate">{content.title}</TableCell>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.duration}</TableCell>
                            <TableCell>{content.views.toLocaleString()}</TableCell>
                            <TableCell>{content.likes}</TableCell>
                            <TableCell>{content.comments}</TableCell>
                            <TableCell>{content.shares}</TableCell>
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
        </main>
      </div>
    </TooltipProvider>
  );
};

export default SnarkyHumansNov24to30;
