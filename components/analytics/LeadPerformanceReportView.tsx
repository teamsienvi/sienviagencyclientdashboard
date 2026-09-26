"use client";

import React, { useState } from "react";
import { 
  Flame, Mail, Send, Eye, MousePointerClick, CheckCircle2, AlertTriangle, 
  XCircle, ShieldCheck, ShieldAlert, Sparkles, Award, Zap, Layers, Radio, 
  Calendar, RefreshCw, Printer, Download, Clock, Info, ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import type { 
  LeadPerformanceReportData, 
  ClientColdPerformance, 
  SegmentPerformance, 
  RecentCampaignItem, 
  ExecutiveHighlight, 
  ClientAudienceVerification 
} from "@/types/leadPerformance";

interface LeadPerformanceReportViewProps {
  clientId: string;
  clientName: string;
  data: LeadPerformanceReportData;
  recency: string;
  onRecencyChange: (newRecency: string) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function LeadPerformanceReportView({
  clientId,
  clientName,
  data,
  recency,
  onRecencyChange,
  isRefreshing = false,
  onRefresh,
}: LeadPerformanceReportViewProps) {
  const totals = data.totals;
  const avTotals = data.audienceVerificationTotals;
  const isOxiSure = clientName.toLowerCase().includes("oxisure");
  const isPlayIQ = clientName.toLowerCase().includes("playiq");

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data.clientBreakdowns || data.clientBreakdowns.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Client Brand",
      "Campaigns",
      "Active Campaigns",
      "Emails Sent",
      "Unique Opens",
      "Open Rate %",
      "Clicks",
      "Replies",
      "Bounces",
      "Bounce Rate %",
      "Target Pool",
      "Performance Tier",
    ];

    const rows = data.clientBreakdowns.map((c) => [
      `"${c.clientBrand.replace(/"/g, '""')}"`,
      c.campaignsCount,
      c.activeCampaignsCount,
      c.emailsSent,
      c.uniqueOpens,
      c.openRate,
      c.clicks,
      c.replies,
      c.bounces,
      c.bounceRate,
      c.targetPool,
      c.performanceTier,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${clientName.replace(/\s+/g, "_")}_Lead_Performance_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/75 backdrop-blur-sm shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Smartlead Cold Outreach &amp; Deliverability Pipeline
          </Badge>
          <span className="text-xs text-muted-foreground">
            Strict Client Isolation Active &bull; Updated {new Date(data.lastUpdated).toLocaleDateString()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          {/* Recency Selector */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={recency} onValueChange={onRecencyChange}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="2_weeks">Last 2 Weeks</SelectItem>
                <SelectItem value="4_weeks">Last 4 Weeks</SelectItem>
                <SelectItem value="8_weeks">Last 8 Weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>

          {/* Print PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </Button>

          {/* Refresh / Sync */}
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 gap-1.5 text-xs text-primary border-primary/20 hover:border-primary/50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Syncing..." : "Sync Live Data"}
            </Button>
          )}
        </div>
      </div>

      {/* 6 Top Cold Outreach KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Sent */}
        <Card className="hover:shadow-md transition-shadow border-blue-500/20 bg-card/65 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cold Sent</CardTitle>
            <Send className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {totals.totalSent.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totals.totalCampaigns} sequence{totals.totalCampaigns !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Unique Opens */}
        <Card className="hover:shadow-md transition-shadow border-emerald-500/20 bg-card/65 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Unique Opens</CardTitle>
            <Eye className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {totals.avgOpenRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totals.totalOpens.toLocaleString()} open{totals.totalOpens !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Replies */}
        <Card className="hover:shadow-md transition-shadow border-rose-500/20 bg-card/65 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Direct Replies</CardTitle>
            <Flame className="h-3.5 w-3.5 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {totals.totalReplies.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totals.totalSent > 0 ? ((totals.totalReplies / totals.totalSent) * 100).toFixed(1) : 0}% reply rate
            </p>
          </CardContent>
        </Card>

        {/* Bounces & Delivery Safety */}
        <Card className="hover:shadow-md transition-shadow border-amber-500/20 bg-card/65 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Bounces &amp; Safety</CardTitle>
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {totals.avgBounceRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totals.totalBounces} bounce{totals.totalBounces !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Active Campaigns */}
        <Card className="hover:shadow-md transition-shadow border-purple-500/20 bg-card/65 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Sequences</CardTitle>
            <Radio className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {totals.activeCampaigns}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totals.completedCampaigns} completed
            </p>
          </CardContent>
        </Card>

        {/* Verified Target Pool */}
        <Card className="hover:shadow-md transition-shadow border-teal-500/20 bg-card/65 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Target Audience</CardTitle>
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
              {totals.totalTargetPool.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {avTotals.validCount.toLocaleString()} verified valid
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Executive Highlights Section */}
      {data.executiveHighlights && data.executiveHighlights.length > 0 && (
        <Card className="bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Strategic Campaign Intelligence &amp; Deliverability Audits
            </CardTitle>
            <CardDescription className="text-xs">
              Executive takeaways from cold audience engagements, domain health, and response patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {data.executiveHighlights.map((hl) => {
                const isSuccess = hl.type === "success";
                const isWarning = hl.type === "warning";
                const isInfo = hl.type === "info";

                return (
                  <div
                    key={hl.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSuccess
                        ? "bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/20"
                        : isWarning
                        ? "bg-amber-500/5 border-amber-500/20 dark:bg-amber-950/20"
                        : "bg-blue-500/5 border-blue-500/20 dark:bg-blue-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {isSuccess && <Award className="h-4 w-4 text-emerald-500" />}
                        {isWarning && <ShieldAlert className="h-4 w-4 text-amber-500" />}
                        {isInfo && <Zap className="h-4 w-4 text-blue-500" />}
                        <span className="text-xs font-semibold">{hl.title}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          isSuccess
                            ? "bg-emerald-500/10 text-emerald-600"
                            : isWarning
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        {hl.client}
                      </Badge>
                    </div>
                    <div className="text-sm font-semibold text-foreground mb-1">
                      {hl.headline}
                    </div>
                    <div className="text-xs font-medium text-primary mb-2">
                      {hl.metrics}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {hl.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 03: Lead Generation & Deliverability Verification Pipeline */}
      {data.audienceVerification && data.audienceVerification.length > 0 && (
        <Card className="bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Lead Generation &amp; Deliverability Verification Pipeline
              </CardTitle>
              <CardDescription className="text-xs">
                Pre-screened audience deliverability via live DNS MX resolution, SMTP handshake, and RFC 5322 syntax validation
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {avTotals.avgLegitimacyRate}% Legitimate
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium">Client Workspace</th>
                    <th className="py-2.5 px-3 font-medium">Total Sourced</th>
                    <th className="py-2.5 px-3 font-medium">Valid (Deliverable)</th>
                    <th className="py-2.5 px-3 font-medium">Risky (Catch-All)</th>
                    <th className="py-2.5 px-3 font-medium">Quarantined (Invalid)</th>
                    <th className="py-2.5 px-3 font-medium">Active Leads</th>
                    <th className="py-2.5 px-3 font-medium">Staged / Inactive</th>
                    <th className="py-2.5 px-3 font-medium text-right">Legitimacy Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.audienceVerification.map((av) => {
                    const isHigh = av.legitimacyRate >= 90;
                    const isLow = av.legitimacyRate < 80;

                    return (
                      <tr key={av.clientId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                              {av.clientBrand.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div>{av.clientBrand}</div>
                              {av.segments && av.segments.length > 0 && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {av.segments.length} segment{av.segments.length > 1 ? "s" : ""} verified
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium">{av.totalSourced.toLocaleString()}</td>
                        <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {av.validCount.toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-amber-600 dark:text-amber-400 font-medium">
                          {av.riskyCount > 0 ? (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {av.riskyCount.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-rose-600 dark:text-rose-400 font-semibold">
                          {av.invalidCount > 0 ? (
                            <div className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {av.invalidCount.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-emerald-600">{av.activeCount.toLocaleString()}</td>
                        <td className="py-3 px-3 text-muted-foreground">{av.inactiveCount.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={`text-[11px] ${
                                isHigh
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : isLow
                                  ? "bg-rose-500/10 text-rose-600"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {av.legitimacyRate}%
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold text-foreground">
                    <td className="py-2.5 px-3">CONSOLIDATED PIPELINE</td>
                    <td className="py-2.5 px-3">{avTotals.totalSourced.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-emerald-600">{avTotals.validCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-amber-600">{avTotals.riskyCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-rose-600">{avTotals.invalidCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-emerald-600">{avTotals.activeCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{avTotals.inactiveCount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-300">
                        {avTotals.avgLegitimacyRate}% avg
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Segment Breakdown if available */}
            {data.audienceVerification.some((av) => av.segments && av.segments.length > 0) && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Verified Sourced Audience Segments
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.audienceVerification.flatMap((av) =>
                    (av.segments || []).map((seg, idx) => {
                      const validPct = seg.total > 0 ? ((seg.valid / seg.total) * 100).toFixed(1) : "100";
                      const isQuarantine = seg.invalid > seg.valid;

                      return (
                        <div
                          key={`${av.clientId}-seg-${idx}`}
                          className="p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                              {seg.segmentName}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${
                                isQuarantine
                                  ? "bg-rose-500/10 text-rose-600"
                                  : "bg-emerald-500/10 text-emerald-600"
                              }`}
                            >
                              {validPct}% Valid
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground mt-2">
                            <div>
                              <span>Total:</span> <strong className="text-foreground">{seg.total}</strong>
                            </div>
                            <div>
                              <span>Valid:</span> <strong className="text-emerald-600">{seg.valid}</strong>
                            </div>
                            <div>
                              <span>Risky/Inv:</span>{" "}
                              <strong className={seg.invalid > 0 ? "text-rose-600" : ""}>
                                {seg.risky + seg.invalid}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 04: Client Cold Performance Breakdown Table */}
      {data.clientBreakdowns && data.clientBreakdowns.length > 0 && (
        <Card className="bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              Smartlead Cold Outreach Campaign Performance
            </CardTitle>
            <CardDescription className="text-xs">
              Live dispatches, response tracking, and performance tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium">Client Brand</th>
                    <th className="py-2.5 px-3 font-medium">Campaigns</th>
                    <th className="py-2.5 px-3 font-medium">Emails Sent</th>
                    <th className="py-2.5 px-3 font-medium">Unique Opens</th>
                    <th className="py-2.5 px-3 font-medium">Open Rate</th>
                    <th className="py-2.5 px-3 font-medium">Clicks</th>
                    <th className="py-2.5 px-3 font-medium">Replies</th>
                    <th className="py-2.5 px-3 font-medium">Bounces</th>
                    <th className="py-2.5 px-3 font-medium">Target Pool</th>
                    <th className="py-2.5 px-3 font-medium text-right">Performance Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.clientBreakdowns.map((cb) => {
                    const isHigh = cb.performanceTier === "high";

                    return (
                      <tr key={cb.clientId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                              {cb.clientBrand.substring(0, 2).toUpperCase()}
                            </div>
                            <span>{cb.clientBrand}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium">
                          {cb.campaignsCount}
                          {cb.activeCampaignsCount > 0 && (
                            <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">
                              ({cb.activeCampaignsCount} Active)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium">{cb.emailsSent.toLocaleString()}</td>
                        <td className="py-3 px-3 font-medium text-emerald-600">{cb.uniqueOpens.toLocaleString()}</td>
                        <td className="py-3 px-3 font-semibold text-emerald-600">{cb.openRate}%</td>
                        <td className="py-3 px-3 text-muted-foreground">{cb.clicks.toLocaleString()}</td>
                        <td className="py-3 px-3 font-semibold text-rose-600">{cb.replies.toLocaleString()}</td>
                        <td className="py-3 px-3 text-muted-foreground">{cb.bounces.toLocaleString()}</td>
                        <td className="py-3 px-3 font-medium">{cb.targetPool.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              isHigh
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {cb.performanceTier === "high" ? "High Performer" : "Active Staging"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 05: Audience Segment Reusability & Quarantine Matrix */}
      {data.segmentMatrix && data.segmentMatrix.length > 0 && (
        <Card className="bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                Audience Segment Reusability &amp; Deliverability Quarantine
              </CardTitle>
              <CardDescription className="text-xs">
                Performance across tested cohorts: Validate high-responding segments and quarantine risky domains
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.segmentMatrix.length} Evaluated Segments
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.segmentMatrix.map((seg) => {
                const isRecommended = seg.status === "recommended";
                const isQuarantine = seg.status === "quarantine";

                return (
                  <div
                    key={seg.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isRecommended
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : isQuarantine
                        ? "bg-rose-500/5 border-rose-500/20"
                        : "bg-blue-500/5 border-blue-500/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            isRecommended
                              ? "bg-emerald-500/10 text-emerald-600"
                              : isQuarantine
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          {isRecommended && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {isQuarantine && <XCircle className="h-3 w-3 mr-1" />}
                          {isRecommended
                            ? "Verified Safe Target"
                            : isQuarantine
                            ? "Deliverability Quarantine"
                            : "Testing Cohort"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{seg.category}</span>
                      </div>

                      <h4 className="text-sm font-semibold text-foreground mb-1">
                        {seg.segmentName}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Origin: <strong>{seg.originClient}</strong> &bull; {seg.leadsTotal.toLocaleString()} contacts
                      </p>

                      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-background/50 border mb-3 text-center">
                        <div>
                          <div className="text-[10px] text-muted-foreground">Open Rate</div>
                          <div className="text-xs font-bold text-foreground">
                            {seg.openRate}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Replies</div>
                          <div className="text-xs font-bold text-rose-600">
                            {seg.replyCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">Bounce</div>
                          <div className="text-xs font-bold text-amber-600">
                            {seg.bounceRate}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <div className="text-xs font-semibold text-foreground mb-0.5">
                        {seg.recommendationTitle}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {seg.recommendationNote}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 06: In-Flight & Recent Campaigns Table */}
      {data.recentCampaigns && data.recentCampaigns.length > 0 && (
        <Card className="bg-card/75 backdrop-blur-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-500" />
                In-Flight &amp; Recent Cold Campaigns
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed metrics for recent Smartlead dispatches within {data.timeframeLabel}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {data.recentCampaigns.length} Campaigns
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 px-3 font-medium">Campaign Name</th>
                    <th className="py-2.5 px-3 font-medium">Target Segment</th>
                    <th className="py-2.5 px-3 font-medium">Sent</th>
                    <th className="py-2.5 px-3 font-medium">Opens</th>
                    <th className="py-2.5 px-3 font-medium">Open Rate</th>
                    <th className="py-2.5 px-3 font-medium">Replies</th>
                    <th className="py-2.5 px-3 font-medium">Bounces</th>
                    <th className="py-2.5 px-3 font-medium text-right">Reusability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.recentCampaigns.map((camp) => {
                    const isOngoing = camp.isOngoing;

                    return (
                      <tr key={camp.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-3">
                          {isOngoing ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Completed
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 font-medium text-foreground max-w-[240px]">
                          <div className="truncate">{camp.name}</div>
                          {camp.smartleadId && (
                            <div className="text-[10px] text-muted-foreground">ID #{camp.smartleadId}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{camp.segment}</td>
                        <td className="py-3 px-3 font-medium">{camp.sent.toLocaleString()}</td>
                        <td className="py-3 px-3 text-emerald-600 font-medium">{camp.uniqueOpens.toLocaleString()}</td>
                        <td className="py-3 px-3 font-semibold text-emerald-600">{camp.openRate}%</td>
                        <td className="py-3 px-3 text-rose-600 font-medium">{camp.replies}</td>
                        <td className="py-3 px-3 text-muted-foreground">{camp.bounces}</td>
                        <td className="py-3 px-3 text-right">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              camp.reusabilityTag === "recommended"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {camp.reusabilityTag}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
