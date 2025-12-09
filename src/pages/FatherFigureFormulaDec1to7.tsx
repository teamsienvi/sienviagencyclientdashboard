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
    lastWeek?: number;
    showTrend?: boolean;
    currentValue?: number;
    previousValue?: number;
  }) => (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {showTrend && currentValue !== undefined && previousValue !== undefined && (
            <TrendIndicator current={currentValue} previous={previousValue} />
          )}
        </div>
        {added !== undefined && (
          <p className="text-xs text-green-500">+{added} this week</p>
        )}
        {lastWeek !== undefined && (
          <p className="text-xs text-muted-foreground">Last week: {lastWeek}%</p>
        )}
      </CardContent>
    </Card>
  );

  const TypeBadge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
      Reel: "bg-violet-500/20 text-violet-400 border-violet-500/30",
      Photo: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      Video: "bg-pink-500/20 text-pink-400 border-pink-500/30",
      Post: "bg-secondary text-secondary-foreground border-secondary",
    };
    return (
      <Badge variant="outline" className={colors[type] || colors.Post}>
        {type}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Link>
          <h1 className="text-3xl font-heading font-bold text-foreground">Father Figure Formula</h1>
          <p className="text-muted-foreground">Weekly Performance Insights: Dec 1 - 7</p>
        </div>

        {/* Top Performing Posts */}
        <section className="mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Top Performing Insights
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search posts..."
                    value={topPostsSearch}
                    onChange={(e) => setTopPostsSearch(e.target.value)}
                    className="pl-10 w-64"
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
                      <TableHead>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                              Reach Tier <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Tier 1: 1M+ views</p>
                              <p>Tier 2: 500K – 1M</p>
                              <p>Tier 3: 100K – 500K</p>
                              <p>Tier 4: 50K – 100K</p>
                              <p>Tier 5: &lt;50K</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1">
                              Engagement Tier <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Tier 1: 8%+ engagement</p>
                              <p>Tier 2: 5–8%</p>
                              <p>Tier 3: 3–5%</p>
                              <p>Tier 4: 1–3%</p>
                              <p>Tier 5: &lt;1%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead>Post Tier</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTopPosts.map((post, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <a href={post.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell>{post.views.toLocaleString()}</TableCell>
                        <TableCell>{post.engagementPercent}%</TableCell>
                        <TableCell><Badge variant="secondary">{post.platform}</Badge></TableCell>
                        <TableCell>{post.followers.toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{post.reachTier}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{post.engagementTier}</Badge></TableCell>
                        <TableCell><Badge>{post.postTier}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{post.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Platform Performance Overview Chart */}
        <section className="mb-8">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Platform Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="platform" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="followers" fill="hsl(var(--primary))" name="Followers" />
                    <Bar dataKey="views" fill="hsl(262, 83%, 70%)" name="Views" />
                    <Bar dataKey="interactions" fill="hsl(262, 83%, 80%)" name="Interactions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Platform Content Performance */}
        <section>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Platform Content Performance</CardTitle>
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

                {/* Instagram Tab */}
                <TabsContent value="instagram">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard 
                      title="Total Followers" 
                      value={instagramData.followers.toLocaleString()} 
                      added={instagramData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate" 
                      value={`${instagramData.engagementRate}%`} 
                      lastWeek={instagramData.lastWeekEngagementRate}
                      showTrend
                      currentValue={instagramData.engagementRate}
                      previousValue={instagramData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={instagramData.totalContent}
                      showTrend
                      currentValue={instagramData.totalContent}
                      previousValue={instagramData.lastWeekTotalContent}
                    />
                    <MetricCard 
                      title="Last Week Content" 
                      value={instagramData.lastWeekTotalContent} 
                    />
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
                        {instagramContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell><TypeBadge type={content.type} /></TableCell>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.reach.toLocaleString()}</TableCell>
                            <TableCell>{content.views.toLocaleString()}</TableCell>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard 
                      title="Total Followers" 
                      value={facebookData.followers.toLocaleString()} 
                      added={facebookData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate" 
                      value={`${facebookData.engagementRate}%`} 
                      lastWeek={facebookData.lastWeekEngagementRate}
                      showTrend
                      currentValue={facebookData.engagementRate}
                      previousValue={facebookData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={facebookData.totalContent}
                      showTrend
                      currentValue={facebookData.totalContent}
                      previousValue={facebookData.lastWeekTotalContent}
                    />
                    <MetricCard 
                      title="Last Week Content" 
                      value={facebookData.lastWeekTotalContent} 
                    />
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
                        {facebookContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell><TypeBadge type={content.type} /></TableCell>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.reach.toLocaleString()}</TableCell>
                            <TableCell>{content.views.toLocaleString()}</TableCell>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard 
                      title="Total Followers" 
                      value={tiktokData.followers.toLocaleString()} 
                      added={tiktokData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate" 
                      value={`${tiktokData.engagementRate}%`} 
                      lastWeek={tiktokData.lastWeekEngagementRate}
                      showTrend
                      currentValue={tiktokData.engagementRate}
                      previousValue={tiktokData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={tiktokData.totalContent}
                      showTrend
                      currentValue={tiktokData.totalContent}
                      previousValue={tiktokData.lastWeekTotalContent}
                    />
                    <MetricCard 
                      title="Last Week Content" 
                      value={tiktokData.lastWeekTotalContent} 
                    />
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
                        {tiktokContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell><TypeBadge type={content.type} /></TableCell>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.views.toLocaleString()}</TableCell>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard 
                      title="Total Followers" 
                      value={xData.followers.toLocaleString()} 
                      added={xData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate" 
                      value={`${xData.engagementRate}%`} 
                      lastWeek={xData.lastWeekEngagementRate}
                      showTrend
                      currentValue={xData.engagementRate}
                      previousValue={xData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={xData.totalContent}
                      showTrend
                      currentValue={xData.totalContent}
                      previousValue={xData.lastWeekTotalContent}
                    />
                    <MetricCard 
                      title="Last Week Content" 
                      value={xData.lastWeekTotalContent} 
                    />
                  </div>
                  <div className="overflow-x-auto">
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
                        {xContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell><TypeBadge type={content.type} /></TableCell>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.impressions.toLocaleString()}</TableCell>
                            <TableCell>{content.likes}</TableCell>
                            <TableCell>{content.engagements}</TableCell>
                            <TableCell>{content.profileVisits}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* YouTube Tab */}
                <TabsContent value="youtube">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard 
                      title="Total Subscribers" 
                      value={youtubeData.followers.toLocaleString()} 
                      added={youtubeData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Engagement Rate" 
                      value={`${youtubeData.engagementRate}%`} 
                      lastWeek={youtubeData.lastWeekEngagementRate}
                      showTrend
                      currentValue={youtubeData.engagementRate}
                      previousValue={youtubeData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={youtubeData.totalContent}
                      showTrend
                      currentValue={youtubeData.totalContent}
                      previousValue={youtubeData.lastWeekTotalContent}
                    />
                    <MetricCard 
                      title="Last Week Content" 
                      value={youtubeData.lastWeekTotalContent} 
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Views</TableHead>
                          <TableHead>Likes</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead>Shares</TableHead>
                          <TableHead>Subscribers</TableHead>
                          <TableHead>Impressions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {youtubeContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell className="max-w-xs truncate">{content.title}</TableCell>
                            <TableCell>{content.date}</TableCell>
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

                {/* LinkedIn Tab */}
                <TabsContent value="linkedin">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard 
                      title="Total Followers" 
                      value={linkedinData.followers.toLocaleString()} 
                      added={linkedinData.addedFollowers} 
                    />
                    <MetricCard 
                      title="Impressions Rate" 
                      value={`${linkedinData.engagementRate}%`} 
                      lastWeek={linkedinData.lastWeekEngagementRate}
                      showTrend
                      currentValue={linkedinData.engagementRate}
                      previousValue={linkedinData.lastWeekEngagementRate}
                    />
                    <MetricCard 
                      title="Total Content" 
                      value={linkedinData.totalContent}
                      showTrend
                      currentValue={linkedinData.totalContent}
                      previousValue={linkedinData.lastWeekTotalContent}
                    />
                    <MetricCard 
                      title="Last Week Content" 
                      value={linkedinData.lastWeekTotalContent} 
                    />
                  </div>
                  <div className="overflow-x-auto">
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
                        {linkedinContent.map((content, index) => (
                          <TableRow key={index}>
                            <TableCell>{content.date}</TableCell>
                            <TableCell>{content.impressions}</TableCell>
                            <TableCell>{content.membersReached}</TableCell>
                            <TableCell>{content.profileViewers}</TableCell>
                            <TableCell>{content.followersGained}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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

export default FatherFigureFormulaDec1to7;
