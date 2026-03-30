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

// Data from CSV - Dec 1-7
const topPerformingPosts: TopPerformingPost[] = [
  {
    link: "https://www.instagram.com/reel/DRu3yzsgNEA/",
    views: 1176,
    engagementPercent: 8.83,
    platform: "Instagram",
    followers: 819,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 76,
    postTier: "Tier 2 (Influence)",
    notes: "Exceptional engagement strength"
  },
  {
    link: "https://www.youtube.com/watch?v=Mtvr-WxkD2k",
    views: 1331,
    engagementPercent: 8.17,
    platform: "Youtube",
    followers: 73,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 70,
    postTier: "Tier 2 (Influence)",
    notes: "Strong engagement; narrative format continues to drive connection."
  },
  {
    link: "https://www.youtube.com/watch?v=5Mq9d8URifQ",
    views: 1107,
    engagementPercent: 7.63,
    platform: "Youtube",
    followers: 73,
    reachTier: "Tier 5",
    engagementTier: "Tier 1",
    influence: 3,
    conversion: 3,
    totalScore: 61,
    postTier: "Tier 3 (Growth)",
    notes: "Solid consistency; reinforce emotional depth for higher-tier impact."
  }
];

const instagramData: PlatformData = {
  followers: 819,
  addedFollowers: 15,
  engagementRate: 30.70,
  lastWeekEngagementRate: 26.04,
  totalContent: 24,
  lastWeekTotalContent: 23
};

const instagramContent: InstagramContent[] = [
  { type: "Reel", date: "Monday, Dec 1", reach: 163, views: 184, likesReactions: 14, comments: 0, shares: 1, interactions: 15 },
  { type: "Photo", date: "Monday, Dec 1", reach: 7, views: 32, likesReactions: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Reel", date: "Monday, Dec 1", reach: 898, views: 1176, likesReactions: 85, comments: 2, shares: 17, interactions: 106 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 6, views: 26, likesReactions: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 73, views: 92, likesReactions: 4, comments: 0, shares: 0, interactions: 4 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 113, views: 126, likesReactions: 4, comments: 0, shares: 0, interactions: 4 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 31, views: 39, likesReactions: 4, comments: 0, shares: 0, interactions: 4 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 126, views: 142, likesReactions: 4, comments: 0, shares: 0, interactions: 4 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 167, views: 204, likesReactions: 10, comments: 0, shares: 1, interactions: 13 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 10, views: 55, likesReactions: 4, comments: 0, shares: 0, interactions: 4 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 151, views: 170, likesReactions: 12, comments: 0, shares: 0, interactions: 12 },
  { type: "Photo", date: "Thursday, Dec 4", reach: 8, views: 53, likesReactions: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 144, views: 167, likesReactions: 5, comments: 0, shares: 0, interactions: 5 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 119, views: 151, likesReactions: 4, comments: 2, shares: 0, interactions: 6 },
  { type: "Reel", date: "Friday, Dec 5", reach: 142, views: 162, likesReactions: 1, comments: 0, shares: 0, interactions: 1 },
  { type: "Photo", date: "Friday, Dec 5", reach: 3, views: 24, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 51, views: 78, likesReactions: 2, comments: 0, shares: 0, interactions: 2 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 122, views: 138, likesReactions: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 128, views: 140, likesReactions: 3, comments: 0, shares: 1, interactions: 4 },
  { type: "Photo", date: "Saturday, Dec 6", reach: 8, views: 20, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 22, views: 27, likesReactions: 3, comments: 0, shares: 0, interactions: 3 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 6, views: 12, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Photo", date: "Sunday, Dec 7", reach: 1, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 107, views: 115, likesReactions: 1, comments: 0, shares: 0, interactions: 1 }
];

const facebookData: PlatformData = {
  followers: 183,
  addedFollowers: 30,
  engagementRate: 49.01,
  lastWeekEngagementRate: 46.31,
  totalContent: 22,
  lastWeekTotalContent: 23
};

const facebookContent: FacebookContent[] = [
  { type: "Reel", date: "Monday, Dec 1", reach: 27, views: 34, likesReactions: 9, comments: 0, shares: 0, interactions: 9, linkClicks: 0 },
  { type: "Photo", date: "Monday, Dec 1", reach: 30, views: 44, likesReactions: 10, comments: 0, shares: 1, interactions: 11, linkClicks: 1 },
  { type: "Reel", date: "Monday, Dec 1", reach: 30, views: 34, likesReactions: 11, comments: 0, shares: 1, interactions: 12, linkClicks: 0 },
  { type: "Photo", date: "Tuesday, Dec 2", reach: 32, views: 50, likesReactions: 10, comments: 0, shares: 1, interactions: 11, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 35, views: 93, likesReactions: 10, comments: 0, shares: 6, interactions: 16, linkClicks: 0 },
  { type: "Reel", date: "Tuesday, Dec 2", reach: 84, views: 139, likesReactions: 10, comments: 0, shares: 6, interactions: 16, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 35, views: 43, likesReactions: 10, comments: 0, shares: 1, interactions: 11, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 43, views: 44, likesReactions: 8, comments: 0, shares: 1, interactions: 9, linkClicks: 0 },
  { type: "Photo", date: "Wednesday, Dec 3", reach: 40, views: 66, likesReactions: 8, comments: 1, shares: 1, interactions: 10, linkClicks: 0 },
  { type: "Reel", date: "Wednesday, Dec 3", reach: 42, views: 128, likesReactions: 9, comments: 1, shares: 13, interactions: 23, linkClicks: 0 },
  { type: "Photo", date: "Thursday, Dec 4", reach: 39, views: 73, likesReactions: 6, comments: 0, shares: 5, interactions: 11, linkClicks: 0 },
  { type: "Post", date: "Thursday, Dec 4", reach: 51, views: 87, likesReactions: 7, comments: 1, shares: 2, interactions: 10, linkClicks: 6 },
  { type: "Reel", date: "Thursday, Dec 4", reach: 153, views: 249, likesReactions: 5, comments: 0, shares: 3, interactions: 8, linkClicks: 0 },
  { type: "Photo", date: "Friday, Dec 5", reach: 28, views: 43, likesReactions: 5, comments: 0, shares: 1, interactions: 6, linkClicks: 1 },
  { type: "Post", date: "Friday, Dec 5", reach: 19, views: 36, likesReactions: 5, comments: 0, shares: 0, interactions: 5, linkClicks: 0 },
  { type: "Reel", date: "Friday, Dec 5", reach: 28, views: 151, likesReactions: 6, comments: 0, shares: 12, interactions: 18, linkClicks: 1 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 8, views: 5, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Saturday, Dec 6", reach: 9, views: 13, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Saturday, Dec 6", reach: 12, views: 14, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 6, views: 7, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Photo", date: "Sunday, Dec 7", reach: 6, views: 6, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 },
  { type: "Reel", date: "Sunday, Dec 7", reach: 2, views: 0, likesReactions: 0, comments: 0, shares: 0, interactions: 0, linkClicks: 0 }
];

const tiktokData: PlatformData = {
  followers: 402,
  addedFollowers: 1,
  engagementRate: 7.54,
  lastWeekEngagementRate: 7.52,
  totalContent: 15,
  lastWeekTotalContent: 16
};

const tiktokContent: TikTokContent[] = [
  { type: "Video", date: "Tuesday, Dec 2", views: 126, likes: 3, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Tuesday, Dec 2", views: 134, likes: 0, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Tuesday, Dec 2", views: 94, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Wednesday, Dec 3", views: 192, likes: 5, comments: 0, shares: 0, addToFavorites: 1 },
  { type: "Video", date: "Wednesday, Dec 3", views: 231, likes: 11, comments: 2, shares: 1, addToFavorites: 2 },
  { type: "Video", date: "Thursday, Dec 4", views: 93, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 4", views: 0, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Thursday, Dec 4", views: 97, likes: 1, comments: 1, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 102, likes: 0, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Friday, Dec 5", views: 91, likes: 2, comments: 0, shares: 1, addToFavorites: 1 },
  { type: "Video", date: "Friday, Dec 5", views: 100, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 91, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Saturday, Dec 6", views: 104, likes: 1, comments: 0, shares: 0, addToFavorites: 0 },
  { type: "Video", date: "Sunday, Dec 7", views: 509, likes: 36, comments: 0, shares: 0, addToFavorites: 3 },
  { type: "Video", date: "Sunday, Dec 7", views: 97, likes: 1, comments: 0, shares: 0, addToFavorites: 0 }
];

const xData: PlatformData = {
  followers: 54,
  addedFollowers: 2,
  engagementRate: 72.73,
  lastWeekEngagementRate: 71.11,
  totalContent: 23,
  lastWeekTotalContent: 18
};

const xContent: XContent[] = [
  { type: "Post", date: "Tuesday, Dec 2", impressions: 11, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 33, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Tuesday, Dec 2", impressions: 11, likes: 6, engagements: 7, profileVisits: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 30, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 20, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Wednesday, Dec 3", impressions: 20, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 114, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Thursday, Dec 4", impressions: 104, likes: 4, engagements: 4, profileVisits: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 21, likes: 5, engagements: 5, profileVisits: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 13, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 1, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Friday, Dec 5", impressions: 32, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 8, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 6, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Saturday, Dec 6", impressions: 9, likes: 0, engagements: 1, profileVisits: 1 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 1, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 3, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 5, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 4, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 10, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 13, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 4, likes: 0, engagements: 0, profileVisits: 0 },
  { type: "Post", date: "Sunday, Dec 7", impressions: 9, likes: 0, engagements: 0, profileVisits: 0 }
];

const youtubeData: PlatformData = {
  followers: 73,
  addedFollowers: 10,
  engagementRate: 30.68,
  lastWeekEngagementRate: 26.85,
  totalContent: 16,
  lastWeekTotalContent: 15
};

const youtubeContent: YouTubeContent[] = [
  { title: "You have the power to change your family tree forever.", date: "Monday, Dec 2", duration: 59, likes: 19, comments: 0, shares: 6, views: 1026, subscribers: 0, impressions: 31 },
  { title: "Be the man they look up to as a Father Figure", date: "Monday, Dec 2", duration: 57, likes: 25, comments: 1, shares: 3, views: 742, subscribers: 1, impressions: 57 },
  { title: "A Father's Impact: Guidance, Protection, and Steady Love ❤️", date: "Wednesday, Dec 3", duration: 34, likes: 17, comments: 0, shares: 5, views: 1107, subscribers: 2, impressions: 54 },
  { title: "Fatherhood Takes Heart, Patience, and a Lifetime of Showing Up ❤️", date: "Wednesday, Dec 3", duration: 35, likes: 22, comments: 4, shares: 1, views: 1331, subscribers: 2, impressions: 43 },
  { title: "Raising Confident, Kind Humans Starts with a Father Who Leads with Love ❤️", date: "Thursday, Dec 4", duration: 25, likes: 1, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 8 },
  { title: "Brad Moser on Fatherhood: What Every Parent Can Learn About Growth and Connection #Dadtalks", date: "Thursday, Dec 4", duration: 2049, likes: 4, comments: 1, shares: 3, views: 25, subscribers: 0, impressions: 22 },
  { title: "Why Dads Love Their Daughters So Much", date: "Thursday, Dec 4", duration: 19, likes: 2, comments: 0, shares: 0, views: 5, subscribers: 0, impressions: 54 },
  { title: "The Silent Promise: Always Being There for Your Child ❤️", date: "Thursday, Dec 4", duration: 62, likes: 2, comments: 0, shares: 0, views: 11, subscribers: 0, impressions: 76 },
  { title: "The World Needs Strong Men — Step Into Your Role 💪", date: "Thursday, Dec 4", duration: 10, likes: 0, comments: 0, shares: 0, views: 4, subscribers: 0, impressions: 24 },
  { title: "Why Did This Skeleton Make Me Cry?", date: "Friday, Dec 6", duration: 7, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0, impressions: 10 },
  { title: "The Secret Strength Of Every Real Father", date: "Friday, Dec 6", duration: 20, likes: 0, comments: 0, shares: 0, views: 0, subscribers: 0, impressions: 13 },
  { title: "Father and Daughter Make the Cutest Memory!", date: "Friday, Dec 6", duration: 41, likes: 1, comments: 0, shares: 0, views: 3, subscribers: 0, impressions: 44 },
  { title: "This Baby Just Stole Dad's Seat!", date: "Friday, Dec 6", duration: 16, likes: 1, comments: 0, shares: 0, views: 2, subscribers: 0, impressions: 30 },
  { title: "This Dad's Reaction Will Melt Your Heart", date: "Saturday, Dec 7", duration: 15, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0, impressions: 14 },
  { title: "Why Dads Love Their Daughters So Much", date: "Saturday, Dec 7", duration: 19, likes: 0, comments: 0, shares: 0, views: 5, subscribers: 0, impressions: 45 },
  { title: "Why Dads Show Love Without Words", date: "Saturday, Dec 7", duration: 35, likes: 0, comments: 0, shares: 0, views: 1, subscribers: 0, impressions: 6 }
];

const linkedinData: PlatformData = {
  followers: 32,
  addedFollowers: 0,
  engagementRate: 58.11,
  lastWeekEngagementRate: 51.14,
  totalContent: 16,
  lastWeekTotalContent: 21
};

const linkedinContent: LinkedInContent[] = [
  { date: "Monday, Dec 1", impressions: 9, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Monday, Dec 1", impressions: 8, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Tuesday, Dec 2", impressions: 2, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Wednesday, Dec 3", impressions: 5, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Wednesday, Dec 3", impressions: 1, membersReached: 4, profileViewers: 0, followersGained: 0 },
  { date: "Thursday, Dec 4", impressions: 1, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Thursday, Dec 4", impressions: 3, membersReached: 3, profileViewers: 0, followersGained: 0 },
  { date: "Thursday, Dec 4", impressions: 6, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Friday, Dec 5", impressions: 5, membersReached: 1, profileViewers: 0, followersGained: 0 },
  { date: "Friday, Dec 5", impressions: 3, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Friday, Dec 5", impressions: 1, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Friday, Dec 5", impressions: 3, membersReached: 5, profileViewers: 0, followersGained: 0 },
  { date: "Saturday, Dec 6", impressions: 3, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Saturday, Dec 6", impressions: 1, membersReached: 2, profileViewers: 0, followersGained: 0 },
  { date: "Sunday, Dec 7", impressions: 6, membersReached: 5, profileViewers: 0, followersGained: 0 },
  { date: "Sunday, Dec 7", impressions: 17, membersReached: 6, profileViewers: 0, followersGained: 0 }
];

// Chart Data
const chartData = [
  { platform: "Instagram", followers: 819, views: 3338, interactions: 200 },
  { platform: "Facebook", followers: 183, views: 1359, interactions: 186 },
  { platform: "TikTok", followers: 402, views: 1964, interactions: 74 },
  { platform: "X", followers: 54, views: 482, interactions: 41 },
  { platform: "YouTube", followers: 73, views: 4264, interactions: 118 },
  { platform: "LinkedIn", followers: 32, views: 74, interactions: 43 }
];

const FatherFigureFormulaDec1to7 = () => {
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
    a.download = "father_figure_formula_top_posts_dec1-7.csv";
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
            <TableHead className="min-w-[300px]">Video Title</TableHead>
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
          {filtered.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{item.title}</TableCell>
              <TableCell>{item.date}</TableCell>
              <TableCell>{item.duration}</TableCell>
              <TableCell>{item.views.toLocaleString()}</TableCell>
              <TableCell>{item.likes}</TableCell>
              <TableCell>{item.comments}</TableCell>
              <TableCell>{item.shares}</TableCell>
              <TableCell>{item.subscribers}</TableCell>
              <TableCell>{item.impressions}</TableCell>
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
            <TableHead>Date Published</TableHead>
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
              <TableCell>{item.impressions}</TableCell>
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
        <main className="container mx-auto px-4 py-8">
          {/* Back Link and Title */}
          <div className="mb-8 animate-fade-in">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Clients
            </Link>
            <h1 className="text-4xl font-heading font-bold text-foreground">Father Figure Formula</h1>
            <p className="text-muted-foreground text-lg">Weekly Performance Insights: Dec 1 - 7</p>
          </div>

          {/* Top Performing Insights */}
          <Card className="mb-8 animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-2xl font-heading flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Top Performing Insights
              </CardTitle>
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
                      title="Subscribers" 
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

export default FatherFigureFormulaDec1to7;
