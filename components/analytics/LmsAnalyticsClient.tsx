"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft, Users, BookOpen, Eye, MousePointerClick,
    FlaskConical, Loader2, AlertTriangle, Monitor, RefreshCw,
    GraduationCap, TrendingUp, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface BetaTester {
    email: string;
    full_name: string;
    joined_at: string;
    lessons_completed: number;
    total_lessons: number;
    progress_pct: number;
    engagement_score: number;
    learning_velocity: number;
    at_risk: boolean;
    last_active_at: string;
    onboarding_goal: string | null;
    has_challenge_plan: boolean;
    community_posts: number;
    referrals_sent: number;
}

interface LmsApiResponse {
    summary: {
        beta_testers_count: number;
        total_registered_users: number;
        total_lessons_available: number;
        total_site_sessions_30d: number;
        total_page_views_30d: number;
        unique_visitors_30d: number;
        bounce_rate_30d: number;
    };
    beta_testers: BetaTester[];
    traffic: {
        top_pages: { page: string; views: number }[];
        top_referrers: { referrer: string; sessions: number }[];
        device_breakdown: Record<string, number>;
    };
    timestamp: string;
}

const LmsAnalyticsClient = ({ clientId }: { clientId: string }) => {
    const router = useRouter();

    const { data, isLoading, error, refetch, isFetching } = useQuery<LmsApiResponse>({
        queryKey: ["fff-lms-analytics"],
        queryFn: async () => {
            const res = await fetch("https://qnquitqllwpeivinvhzk.supabase.co/functions/v1/beta-count", {
                headers: { "x-api-key": "Iydknyk1@#$%" },
            });
            if (!res.ok) throw new Error("Failed to fetch LMS data");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    const summary = data?.summary;
    const testers = data?.beta_testers || [];
    const traffic = data?.traffic;

    // Format date for display
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return `${Math.floor(diffDays / 30)}mo ago`;
    };

    // Clean up top_pages to remove tokens and lovable params
    const cleanPageUrl = (page: string) => {
        try {
            const url = new URL(page, "https://example.com");
            const path = url.pathname;
            if (url.search.includes("__lovable_token") || url.search.includes("forceHide")) {
                return path || "/";
            }
            return page;
        } catch {
            return page;
        }
    };

    // Aggregate cleaned pages
    const aggregatedPages = (traffic?.top_pages || []).reduce<Record<string, number>>((acc, p) => {
        const cleaned = cleanPageUrl(p.page);
        acc[cleaned] = (acc[cleaned] || 0) + p.views;
        return acc;
    }, {});
    const sortedPages = Object.entries(aggregatedPages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background">
                <div className="container mx-auto px-4 py-8">
                    <Card>
                        <CardContent className="py-12 text-center">
                            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-4" />
                            <p className="text-muted-foreground mb-4">Failed to load LMS analytics</p>
                            <Button onClick={() => router.back()}>Go Back</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/client/${clientId}`)}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="p-2 rounded-xl bg-amber-500/10">
                                <GraduationCap className="h-6 w-6 text-amber-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-foreground">FFF LMS Analytics</h1>
                                <p className="text-sm text-muted-foreground">Father Figure Formula Course</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="gap-2"
                            >
                                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 space-y-8">
                {/* Last Updated */}
                {data?.timestamp && (
                    <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(data.timestamp).toLocaleString()}
                    </p>
                )}

                {/* KPI Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Beta Testers</CardTitle>
                            <FlaskConical className="h-4 w-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                                {summary?.beta_testers_count ?? "—"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Active beta participants</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-200/50 dark:border-blue-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Registered Users</CardTitle>
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {summary?.total_registered_users ?? "—"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Total accounts created</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500/5 to-green-500/5 border-emerald-200/50 dark:border-emerald-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Lessons Available</CardTitle>
                            <BookOpen className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                {summary?.total_lessons_available ?? "—"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Course content items</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/5 to-violet-500/5 border-purple-200/50 dark:border-purple-800/50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                            <MousePointerClick className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                {summary?.bounce_rate_30d != null ? `${summary.bounce_rate_30d}%` : "—"}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Traffic Stats Row */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Site Sessions</CardTitle>
                            <Globe className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.total_site_sessions_30d ?? "—"}</div>
                            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.total_page_views_30d ?? "—"}</div>
                            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{summary?.unique_visitors_30d ?? "—"}</div>
                            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Beta Testers Table */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <FlaskConical className="h-5 w-5 text-amber-500" />
                                    Beta Testers
                                </CardTitle>
                                <CardDescription>
                                    {testers.length} beta tester{testers.length !== 1 ? "s" : ""} enrolled
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                    {testers.filter(t => !t.at_risk).length} Active
                                </Badge>
                                <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                                    {testers.filter(t => t.at_risk).length} At Risk
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Progress</TableHead>
                                        <TableHead className="text-center">Lessons</TableHead>
                                        <TableHead className="text-center">Engagement</TableHead>
                                        <TableHead className="text-center">Velocity</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead>Last Active</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {testers.map((tester, i) => {
                                        const cappedProgress = Math.min(tester.progress_pct, 100);
                                        const cappedCompleted = Math.min(tester.lessons_completed, tester.total_lessons);
                                        
                                        return (
                                        <TableRow key={i}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{tester.full_name}</p>
                                                    <p className="text-xs text-muted-foreground">{tester.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 min-w-[120px]">
                                                    <Progress
                                                        value={cappedProgress}
                                                        className="h-2 flex-1"
                                                    />
                                                    <span className="text-xs font-medium w-12 text-right">
                                                        {cappedProgress.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-medium">{cappedCompleted}</span>
                                                <span className="text-muted-foreground">/{tester.total_lessons}</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-medium ${tester.engagement_score >= 20 ? "text-green-600" : tester.engagement_score > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                                                    {tester.engagement_score > 0 ? tester.engagement_score.toFixed(1) : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-medium">
                                                    {tester.learning_velocity > 0 ? `${tester.learning_velocity.toFixed(2)}x` : "—"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {formatDate(tester.joined_at)}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {formatRelativeTime(tester.last_active_at)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {tester.at_risk ? (
                                                    <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        At Risk
                                                    </Badge>
                                                ) : tester.progress_pct >= 100 ? (
                                                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                                        Completed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                                                        Active
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Traffic Section */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Top Pages */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Eye className="h-4 w-4 text-emerald-500" />
                                Top Pages
                            </CardTitle>
                            <CardDescription>Most viewed pages (last 30 days)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {sortedPages.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">No page data available</p>
                            ) : (
                                <div className="space-y-3">
                                    {sortedPages.map(([page, views], i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <span className="text-sm font-mono truncate max-w-[200px]" title={page}>
                                                {page}
                                            </span>
                                            <Badge variant="outline">{views} view{views !== 1 ? "s" : ""}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Referrers & Devices */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <TrendingUp className="h-4 w-4 text-blue-500" />
                                    Top Referrers
                                </CardTitle>
                                <CardDescription>Traffic sources (last 30 days)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {(traffic?.top_referrers || []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No referrer data</p>
                                ) : (
                                    <div className="space-y-3">
                                        {traffic!.top_referrers.map((ref, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className="text-sm truncate max-w-[200px]" title={ref.referrer}>
                                                    {ref.referrer}
                                                </span>
                                                <Badge variant="outline">{ref.sessions} session{ref.sessions !== 1 ? "s" : ""}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Monitor className="h-4 w-4 text-purple-500" />
                                    Device Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!traffic?.device_breakdown || Object.keys(traffic.device_breakdown).length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">No device data</p>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(traffic.device_breakdown).map(([device, count], i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className="text-sm capitalize">{device}</span>
                                                <Badge variant="outline">{count} session{count !== 1 ? "s" : ""}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LmsAnalyticsClient;
