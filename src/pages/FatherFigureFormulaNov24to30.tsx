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
  reach: number;
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
  likes: number;
  engagements: number;
  profileVisits: number;
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

interface LinkedInContent {
  date: string;
  impressions: number;
  membersReached: number;
  profileViewers: number;
  followersGained: number;
}

interface PlatformData {
  followers: number;
  addedFollowers: number;
  engagementRate: number;
  lastWeekEngagementRate: number;
  totalContent: number;
  lastWeekTotalContent: number;
}

// Data from CSV
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.instagram.com/reel/DRfFz9JD3yN/?fbclid=IwY2xjawOaz3VleHRuA2FlbQIxMABicmlkETFFWmVObHpPaXlZZGdsVWJOc3J0YwZhcHBfaWQPNTE0NzcxNTY5MjI4MDYxAAEeKsCcPsaRot4r9JlqF_wKBXapjFzPjrXEHsV8OqO9hy8NrPt8CJQVfD-wd-M_aem_C33DJZ6S41r1EvlXswchcw",
    views: 1581,
    engagementPercent: 8.93,
    platform: "Instagram",
    followers: 804,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 70,
    postTier: "Tier 2 (Influence)",
    notes: "Solid engagement for the size of reach"
  },
  {
    link: "https://www.instagram.com/reel/DRmy0WzgYld/?fbclid=IwY2xjawOaz85leHRuA2FlbQIxMABicmlkETFFWmVObHpPaXlZZGdsVWJOc3J0YwZhcHBfaWQPNTE0NzcxNTY5MjI4MDYxAAEeKsCcPsaRot4r9JlqF_wKBXapjFzPjrXEHsV8OqO9hy8NrPt8CJQVfD-wd-M_aem_C33DJZ6S41r1EvlXswchcw",
    views: 1417,
    engagementPercent: 7.56,
    platform: "Instagram",
    followers: 804,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 62,
    postTier: "Tier 3 (Growth)",
    notes: "Healthy engagement; improving visibility"
  },
  {
    link: "https://www.youtube.com/watch?v=ylk2CM4xSDk",
    views: 1274,
    engagementPercent: 9.00,
    platform: "Youtube",
    followers: 63,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 59,
    postTier: "Tier 3 (Growth)",
    notes: "Strong CTR indicates high viewer intent"
  }
];

const instagramData: PlatformData = {
  followers: 804,
  addedFollowers: 16,
  engagementRate: 26.04,
  lastWeekEngagementRate: 24.63,
  totalContent: 23,
  lastWeekTotalContent: 24
};

const instagramContent: InstagramContent[] = [
  { type: "Reel", date: "Mon Nov 24", reach: 127, views: 143, likesReactions: 6, comments: 0, shares: 0, interactions: 8 },
  { type: "Reel", date: "Mon Nov 24", reach: 234, views: 273, likesReactions: 10, comments: 0, shares: 1, interactions: 11 },
  { type: "Photo", date: "Mon Nov 24", reach: 16, views: 84, likesReactions: 3, comments: 1, shares: 0, interactions: 4 },
  { type: "Photo", date: "Tue Nov 25", reach: 13, views: 78, likesReactions: 3, comments: 1, shares: 0, interactions: 4 },
  { type: "Reel", date: "Tue Nov 25", reach: 1238, views: 1578, likesReactions: 68, comments: 2, shares: 12, interactions: 86 },
  { type: "Reel", date: "Tue Nov 25", reach: 741, views: 859, likesReactions: 19, comments: 2, shares: 6, interactions: 31 },
  { type: "Photo", date: "Wed Nov 26", reach: 7, views: 71, likesReactions: 2, comments: 1, shares: 0, interactions: 3 },
  { type: "Reel", date: "Wed Nov 26", reach: 130, views: 147, likesReactions: 3, comments: 2, shares: 0, interactions: 5 },
  { type: "Reel", date: "Wed Nov 26", reach: 138, views: 169, likesReactions: 8, comments: 2, shares: 6, interactions: 20 },
  { type: "Photo", date: "Thu Nov 27", reach: 6, views: 51, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
  { type: "Reel", date: "Thu Nov 27", reach: 149, views: 194, likesReactions: 3, comments: 1, shares: 0, interactions: 4 },
  { type: "Reel", date: "Thu Nov 27", reach: 131, views: 150, likesReactions: 1, comments: 1, shares: 0, interactions: 2 },
  { type: "Reel", date: "Fri Nov 28", reach: 1248, views: 1414, likesReactions: 29, comments: 2, shares: 6, interactions: 39 },
  { type: "Photo", date: "Fri Nov 28", reach: 4, views: 29, likesReactions: 1, comments: 1, shares: 0, interactions: 2 },
  { type: "Reel", date: "Fri Nov 28", reach: 119, views: 142, likesReactions: 4, comments: 2, shares: 0, interactions: 7 },
  { type: "Reel", date: "Sat Nov 29", reach: 377, views: 569, likesReactions: 17, comments: 0, shares: 5, interactions: 24 },
  { type: "Photo", date: "Sat Nov 29", reach: 5, views: 28, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sat Nov 29", reach: 139, views: 168, likesReactions: 1, comments: 0, shares: 1, interactions: 2 },
  { type: "Reel", date: "Sat Nov 29", reach: 9, views: 19, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sun Nov 30", reach: 91, views: 126, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sun Nov 30", reach: 15, views: 31, likesReactions: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Reel", date: "Sun Nov 30", reach: 301, views: 391, likesReactions: 16, comments: 0, shares: 2, interactions: 18 },
  { type: "Reel", date: "Sun Nov 30", reach: 4, views: 4, likesReactions: 0, comments: 0, shares: 0, interactions: 0 }
];

const facebookData: PlatformData = {
  followers: 153,
  addedFollowers: 0,
  engagementRate: 46.31,
  lastWeekEngagementRate: 47.58,
  totalContent: 23,
  lastWeekTotalContent: 24
};

const facebookContent: FacebookContent[] = [
  { type: "Reel", date: "Mon Nov 24", reach: 20, views: 46, likesReactions: 7, comments: 0, shares: 2, interactions: 9, linkClicks: 0 },
  { type: "Reel", date: "Mon Nov 24", reach: 16, views: 24, likesReactions: 7, comments: 0, shares: 2, interactions: 9, linkClicks: 0 },
  { type: "Photo", date: "Mon Nov 24", reach: 14, views: 24, likesReactions: 7, comments: 0, shares: 0, interactions: 7, linkClicks: 0 },
  { type: "Photo", date: "Tue Nov 25", reach: 15, views: 29, likesReactions: 6, comments: 0, shares: 3, interactions: 9, linkClicks: 0 },
  { type: "Reel", date: "Tue Nov 25", reach: 280, views: 279, likesReactions: 13, comments: 2, shares: 1, interactions: 16, linkClicks: 0 },
  { type: "Reel", date: "Tue Nov 25", reach: 21, views: 113, likesReactions: 7, comments: 1, shares: 2, interactions: 10, linkClicks: 0 },
  { type: "Photo", date: "Wed Nov 26", reach: 16, views: 24, likesReactions: 6, comments: 0, shares: 0, interactions: 6, linkClicks: 0 },
  { type: "Reel", date: "Wed Nov 26", reach: 42, views: 131, likesReactions: 7, comments: 0, shares: 4, interactions: 11, linkClicks: 0 },
  { type: "Reel", date: "Wed Nov 26", reach: 12, views: 99, likesReactions: 6, comments: 0, shares: 12, interactions: 18, linkClicks: 0 },
  { type: "Photo", date: "Thu Nov 27", reach: 22, views: 39, likesReactions: 6, comments: 1, shares: 8, interactions: 15, linkClicks: 0 },
  { type: "Reel", date: "Thu Nov 27", reach: 24, views: 115, likesReactions: 6, comments: 0, shares: 6, interactions: 12, linkClicks: 0 },
  { type: "Reel", date: "Thu Nov 27", reach: 48, views: 160, likesReactions: 7, comments: 0, shares: 10, interactions: 17, linkClicks: 0 },
  { type: "Reel", date: "Fri Nov 28", reach: 22, views: 22, likesReactions: 5, comments: 0, shares: 0, interactions: 5, linkClicks: 0 },
  { type: "Photo", date: "Fri Nov 28", reach: 14, views: 28, likesReactions: 5, comments: 0, shares: 7, interactions: 12, linkClicks: 0 },
  { type: "Reel", date: "Fri Nov 28", reach: 16, views: 140, likesReactions: 5, comments: 0, shares: 15, interactions: 20, linkClicks: 0 },
  { type: "Reel", date: "Sat Nov 29", reach: 9, views: 4, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sat Nov 29", reach: 5, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sat Nov 29", reach: 12, views: 15, likesReactions: 2, comments: 0, shares: 0, interactions: 2, linkClicks: 0 },
  { type: "Reel", date: "Sat Nov 29", reach: 7, views: 15, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sun Nov 30", reach: 5, views: 2, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sun Nov 30", reach: 5, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sun Nov 30", reach: 209, views: 237, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sun Nov 30", reach: 4, views: 3, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

const tiktokData: PlatformData = {
  followers: 401,
  addedFollowers: 2,
  engagementRate: 7.52,
  lastWeekEngagementRate: 7.68,
  totalContent: 16,
  lastWeekTotalContent: 16
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "Sun Nov 30", views: 122, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sun Nov 30", views: 105, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sat Nov 29", views: 169, likes: 6, comments: 0, shares: 0, addToFavorites: 2 },
  { type: "Video", date: "Sat Nov 29", views: 695, likes: 48, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Sat Nov 29", views: 102, likes: 2, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Fri Nov 28", views: 220, likes: 9, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Fri Nov 28", views: 227, likes: 10, comments: 1, shares: 1, addToFavorites: 0 },
  { type: "Video", date: "Thu Nov 27", views: 104, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thu Nov 27", views: 112, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wed Nov 26", views: 113, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wed Nov 26", views: 100, likes: 3, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wed Nov 26", views: 113, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tue Nov 25", views: 103, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tue Nov 25", views: 210, likes: 15, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tue Nov 25", views: 88, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Mon Nov 24", views: 103, likes: 0, comments: 0, shares: 0, addToFavorites: 0 }
];

const xData: PlatformData = {
  followers: 52,
  addedFollowers: 0,
  engagementRate: 71.11,
  lastWeekEngagementRate: 76.10,
  totalContent: 18,
  lastWeekTotalContent: 24
};

const xContent: XContent[] = [
  { type: "Post", date: "Sun Nov 30", impressions: 23, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sun Nov 30", impressions: 7, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sat Nov 29", impressions: 11, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sat Nov 29", impressions: 17, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Fri Nov 28", impressions: 14, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Fri Nov 28", impressions: 9, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Fri Nov 28", impressions: 139, likes: 7, engagements: 8, profileVisits: 0 },
  { type: "Post", date: "Thu Nov 27", impressions: 19, likes: 7, engagements: 7, profileVisits: 0 },
  { type: "Post", date: "Thu Nov 27", impressions: 17, likes: 7, engagements: 7, profileVisits: 0 },
  { type: "Post", date: "Thu Nov 27", impressions: 22, likes: 7, engagements: 8, profileVisits: 0 },
  { type: "Post", date: "Wed Nov 26", impressions: 14, likes: 7, engagements: 7, profileVisits: 0 },
  { type: "Post", date: "Wed Nov 26", impressions: 8, likes: 7, engagements: 7, profileVisits: 0 },
  { type: "Post", date: "Tue Nov 25", impressions: 12, likes: 7, engagements: 7, profileVisits: 0 },
  { type: "Post", date: "Tue Nov 25", impressions: 27, likes: 8, engagements: 9, profileVisits: 0 },
  { type: "Post", date: "Tue Nov 25", impressions: 32, likes: 8, engagements: 9, profileVisits: 0 },
  { type: "Post", date: "Tue Nov 25", impressions: 57, likes: 8, engagements: 9, profileVisits: 0 },
  { type: "Post", date: "Mon Nov 24", impressions: 45, likes: 7, engagements: 9, profileVisits: 0 },
  { type: "Post", date: "Mon Nov 24", impressions: 21, likes: 7, engagements: 7, profileVisits: 0 }
];

const youtubeData: PlatformData = {
  followers: 63,
  addedFollowers: 15,
  engagementRate: 26.85,
  lastWeekEngagementRate: 25.24,
  totalContent: 15,
  lastWeekTotalContent: 16
};

const youtubeContent: YouTubeContent[] = [
  { title: "The Overflow of a Father's Love Is a Feeling Like No Other ❤️", date: "Nov 30, 2025", duration: 9, likes: 11, comments: 0, shares: 1, views: 984, subscribers: 1, impressions: 3 },
  { title: "A Son's True Strength Comes from a Father Who Guides, Not Controls ❤️", date: "Nov 30, 2025", duration: 41, likes: 0, comments: 0, shares: 0, views: 3, subscribers: 0, impressions: 11 },
  { title: "Presence Over Perfection — Love Shows Up Even in the Mess 🌧️", date: "Nov 30, 2025", duration: 12, likes: 22, comments: 0, shares: 1, views: 811, subscribers: 1, impressions: 37 },
  { title: "A Father's Message Is Felt in Actions, Not Words ❤️", date: "Nov 29, 2025", duration: 57, likes: 1, comments: 0, shares: 0, views: 9, subscribers: 0, impressions: 19 },
  { title: "Love Comes in Many Forms — But Presence Is Always the Greatest 💙", date: "Nov 29, 2025", duration: 11, likes: 16, comments: 0, shares: 0, views: 754, subscribers: 0, impressions: 25 },
  { title: "Every Act of Love Becomes Their Story — Write a Legacy That Lasts 📖", date: "Nov 29, 2025", duration: 10, likes: 10, comments: 0, shares: 0, views: 625, subscribers: 0, impressions: 2 },
  { title: "A Father's Journey: Lifting Their Hearts Higher Every Day ❤️", date: "Nov 28, 2025", duration: 58, likes: 0, comments: 0, shares: 0, views: 2, subscribers: 0, impressions: 7 },
  { title: "Lead Your Family with Purpose — You're the CEO of Your Home", date: "Nov 28, 2025", duration: 12, likes: 38, comments: 0, shares: 2, views: 1140, subscribers: 3, impressions: 21 },
  { title: "Fatherhood Is Growth — Become the Strongest Version of Yourself", date: "Nov 27, 2025", duration: 58, likes: 1, comments: 0, shares: 0, views: 126, subscribers: 0, impressions: 31 },
  { title: "Set the Standard — They Learn Manhood and Love from You", date: "Nov 27, 2025", duration: 18, likes: 15, comments: 0, shares: 0, views: 1274, subscribers: 0, impressions: 78 },
  { title: "The Greatest Gift a Father Gives Is His Time ❤️", date: "Nov 26, 2025", duration: 78, likes: 4, comments: 0, shares: 1, views: 224, subscribers: 0, impressions: 26 },
  { title: "Real Heroes Don't Wear Capes — They Show Up ❤️", date: "Nov 26, 2025", duration: 19, likes: 19, comments: 0, shares: 0, views: 1002, subscribers: 4, impressions: 50 },
  { title: "A Father's Love Becomes the Legacy That Lasts for Generations 🌅", date: "Nov 25, 2025", duration: 55, likes: 16, comments: 0, shares: 0, views: 642, subscribers: 0, impressions: 66 },
  { title: "Core Memories Are Built in the Little Moments ❤️", date: "Nov 25, 2025", duration: 58, likes: 11, comments: 0, shares: 0, views: 711, subscribers: 0, impressions: 17 },
  { title: "Success Starts with a Father's Presence: Time, Attention, and Support ❤️", date: "Nov 24, 2025", duration: 21, likes: 25, comments: 0, shares: 1, views: 946, subscribers: 2, impressions: 59 }
];

const linkedinData: PlatformData = {
  followers: 32,
  addedFollowers: 0,
  engagementRate: 51.14,
  lastWeekEngagementRate: 51.47,
  totalContent: 21,
  lastWeekTotalContent: 22
};

const linkedinContent: LinkedInContent[] = [
  { date: "Nov 24, 2025", impressions: 5, membersReached: 3, profileViewers: 0, followersGained: 0 },
  { date: "Nov 24, 2025", impressions: 4, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 24, 2025", impressions: 8, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 25, 2025", impressions: 3, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 25, 2025", impressions: 3, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 25, 2025", impressions: 3, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 25, 2025", impressions: 2, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 26, 2025", impressions: 20, membersReached: 10, profileViewers: 0, followersGained: 0 },
  { date: "Nov 26, 2025", impressions: 3, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Nov 26, 2025", impressions: 1, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 27, 2025", impressions: 4, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Nov 27, 2025", impressions: 2, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Nov 27, 2025", impressions: 1, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 28, 2025", impressions: 13, membersReached: 7, profileViewers: 0, followersGained: 0 },
  { date: "Nov 28, 2025", impressions: 4, membersReached: 3, profileViewers: 0, followersGained: 0 },
  { date: "Nov 28, 2025", impressions: 2, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 29, 2025", impressions: 5, membersReached: 3, profileViewers: 0, followersGained: 0 },
  { date: "Nov 29, 2025", impressions: 2, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 30, 2025", impressions: 1, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 30, 2025", impressions: 1, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Nov 30, 2025", impressions: 1, membersReached: 1, profileViewers: 0, followersGained: 0 }
];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 804, views: 6718, interactions: 273 },
  { platform: "Facebook", followers: 153, views: 1563, interactions: 178 },
  { platform: "TikTok", followers: 401, views: 2686, interactions: 101 },
  { platform: "X", followers: 52, views: 494, interactions: 94 },
  { platform: "YouTube", followers: 63, views: 9253, interactions: 195 },
  { platform: "LinkedIn", followers: 32, views: 88, interactions: 45 }
];

const FatherFigureFormulaNov24to30 = () => {
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
    a.download = "father_figure_formula_top_posts_nov24-30.csv";
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
              <TableCell>{item.reach.toLocaleString()}</TableCell>
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
            <TableHead>Likes</TableHead>
            <TableHead>Engagements</TableHead>
            <TableHead>Profile Visits</TableHead>
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
              <TableCell>{item.likes}</TableCell>
              <TableCell>{item.engagements}</TableCell>
              <TableCell>{item.profileVisits}</TableCell>
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
          {/* Back Button */}
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Clients</span>
          </Link>

          {/* Client Info */}
          <div className="mb-8 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Father Figure Formula</h1>
                <p className="text-muted-foreground text-lg">Weekly Performance Insights (Nov 24-30)</p>
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
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Reach Tier</p>
                              <p>Tier 1: 1M+ views</p>
                              <p>Tier 2: 500K – 1M</p>
                              <p>Tier 3: 100K – 500K</p>
                              <p>Tier 4: 50K – 100K</p>
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
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Engagement Tier</p>
                              <p>Tier 1: 8%+ engagement rate</p>
                              <p>Tier 2: 5–8%</p>
                              <p>Tier 3: 3–5%</p>
                              <p>Tier 4: 1–3%</p>
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
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Influence (1-5 Scale)</p>
                              <p>Quality of interactions:</p>
                              <p>• Mentions from authority accounts</p>
                              <p>• Shares by influencers</p>
                              <p>• Media pickups or organic reposts</p>
                              <p>• Collaboration requests</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Conversion
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-semibold mb-1">Conversion Signals (1-5 Scale)</p>
                              <p>• Click-throughs to site/landing page</p>
                              <p>• DM inquiries</p>
                              <p>• Newsletter signups</p>
                              <p>• Purchases directly attributed</p>
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
                    {filteredTopPosts.map((post, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <a
                            href={post.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            View Post
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>{post.views.toLocaleString()}</TableCell>
                        <TableCell>{post.engagementPercent}%</TableCell>
                        <TableCell>
                          <Badge variant="default">{post.platform}</Badge>
                        </TableCell>
                        <TableCell>{post.followers.toLocaleString()}</TableCell>
                        <TableCell>{post.reachTier}</TableCell>
                        <TableCell>{post.engagementTier}</TableCell>
                        <TableCell>{post.influence}</TableCell>
                        <TableCell>{post.conversion}</TableCell>
                        <TableCell className="font-bold">{post.totalScore}</TableCell>
                        <TableCell>{post.postTier}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={post.notes}>
                          {post.notes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Platform Performance Chart */}
          <Card className="mb-8 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl font-heading">Platform Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Bar dataKey="followers" name="Followers" fill="hsl(262, 83%, 58%)" />
                  <Bar dataKey="views" name="Total Views" fill="hsl(262, 83%, 70%)" />
                  <Bar dataKey="interactions" name="Total Interactions" fill="hsl(262, 83%, 85%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform Content Performance */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl font-heading">Platform Content Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="instagram" className="w-full">
                <TabsList className="grid w-full grid-cols-6 mb-6">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                  <TabsTrigger value="x">X</TabsTrigger>
                  <TabsTrigger value="youtube">YouTube</TabsTrigger>
                  <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                </TabsList>

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
                      lastWeek={`${instagramData.lastWeekEngagementRate}%`}
                      showTrend
                      currentValue={instagramData.engagementRate}
                      previousValue={instagramData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={instagramData.totalContent}
                      lastWeek={instagramData.lastWeekTotalContent.toString()}
                      showTrend
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
                  <div className="overflow-x-auto">{renderInstagramTable()}</div>
                </TabsContent>

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
                      lastWeek={`${facebookData.lastWeekEngagementRate}%`}
                      showTrend
                      currentValue={facebookData.engagementRate}
                      previousValue={facebookData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={facebookData.totalContent}
                      lastWeek={facebookData.lastWeekTotalContent.toString()}
                      showTrend
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
                  <div className="overflow-x-auto">{renderFacebookTable()}</div>
                </TabsContent>

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
                      lastWeek={`${tiktokData.lastWeekEngagementRate}%`}
                      showTrend
                      currentValue={tiktokData.engagementRate}
                      previousValue={tiktokData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={tiktokData.totalContent}
                      lastWeek={tiktokData.lastWeekTotalContent.toString()}
                      showTrend
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
                  <div className="overflow-x-auto">{renderTikTokTable()}</div>
                </TabsContent>

                <TabsContent value="x">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <MetricCard 
                      title="Followers" 
                      value={xData.followers.toLocaleString()} 
                      added={xData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${xData.engagementRate}%`}
                      lastWeek={`${xData.lastWeekEngagementRate}%`}
                      showTrend
                      currentValue={xData.engagementRate}
                      previousValue={xData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={xData.totalContent}
                      lastWeek={xData.lastWeekTotalContent.toString()}
                      showTrend
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
                  <div className="overflow-x-auto">{renderXTable()}</div>
                </TabsContent>

                <TabsContent value="youtube">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <MetricCard 
                      title="Followers" 
                      value={youtubeData.followers.toLocaleString()} 
                      added={youtubeData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate %" 
                      value={`${youtubeData.engagementRate}%`}
                      lastWeek={`${youtubeData.lastWeekEngagementRate}%`}
                      showTrend
                      currentValue={youtubeData.engagementRate}
                      previousValue={youtubeData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={youtubeData.totalContent}
                      lastWeek={youtubeData.lastWeekTotalContent.toString()}
                      showTrend
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
                  <div className="overflow-x-auto">{renderYouTubeTable()}</div>
                </TabsContent>

                <TabsContent value="linkedin">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <MetricCard 
                      title="Followers" 
                      value={linkedinData.followers.toLocaleString()} 
                      added={linkedinData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Impressions Rate %" 
                      value={`${linkedinData.engagementRate}%`}
                      lastWeek={`${linkedinData.lastWeekEngagementRate}%`}
                      showTrend
                      currentValue={linkedinData.engagementRate}
                      previousValue={linkedinData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={linkedinData.totalContent}
                      lastWeek={linkedinData.lastWeekTotalContent.toString()}
                      showTrend
                      currentValue={linkedinData.totalContent}
                      previousValue={linkedinData.lastWeekTotalContent}
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
                  <div className="overflow-x-auto">{renderLinkedInTable()}</div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default FatherFigureFormulaNov24to30;
