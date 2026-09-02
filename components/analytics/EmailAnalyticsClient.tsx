"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, Mail, Send, CheckCircle2, Eye, MousePointerClick, 
  RefreshCw, BarChart3, Info, AlertCircle, Calendar, ChevronRight, ExternalLink,
  ChevronDown, ChevronUp, User, Clock, Sparkles, Inbox
} from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";
import { getEmailCampaignMetrics, EmailCampaignMetricsResponse, EmailCampaignDetail } from "@/server/queries/email";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EmailAnalyticsClientProps {
  clientId: string;
  clientName: string;
  clientLogo: string | null;
  initialData: EmailCampaignMetricsResponse;
}

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#ec4899"];

const EmailAnalyticsClient = ({ 
  clientId, 
  clientName, 
  clientLogo, 
  initialData 
}: EmailAnalyticsClientProps) => {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaignDetail | null>(null);
  const [expandedEmailIndex, setExpandedEmailIndex] = useState<number | null>(0);

  // Map client names to verified Resend sender info
  const CLIENT_SENDERS: Record<string, { email: string; name: string; replyTo: string }> = {
    "Serenity Scrolls": { email: "sender@serenityscrolls.faith", name: "Serenity Scrolls", replyTo: "info@serenityscrolls.faith" },
    "Billionaire Brother": { email: "sender@mybillionairebrother.com", name: "Billionaire Brother", replyTo: "yourbro@thebillionairebrother.com" },
    "The Billionaire Brother": { email: "sender@mybillionairebrother.com", name: "Billionaire Brother", replyTo: "yourbro@thebillionairebrother.com" },
    "Father Figure Formula": { email: "sender@fatherfigureformula.com", name: "Father Figure Formula", replyTo: "info@fatherfigureformula.com" },
    "PlayIQ": { email: "sender@sienvi.com", name: "PlayIQ", replyTo: "info.playiq@gmail.com" },
    "CheerCPT": { email: "sender@cheercpt.com", name: "CheerCPT", replyTo: "info@cheercpt.com" },
    "Snarky Humans": { email: "sender@snarkyazzhumans.com", name: "Snarky Humans", replyTo: "teamsienvi@gmail.com" },
  };

  const currentSender = useMemo(() => {
    return CLIENT_SENDERS[clientName] || { email: "sender@sienvi.com", name: "Sienvi Sender", replyTo: "teamsienvi@gmail.com" };
  }, [clientName]);

  // Tanstack query to support client-side manual polling/refreshes
  const { data: metricsData, refetch } = useQuery({
    queryKey: ["email-analytics", clientName],
    queryFn: async () => {
      const data = await getEmailCampaignMetrics(clientName);
      return data;
    },
    initialData,
    refetchInterval: 300000, // Auto-refresh every 5 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const aggregates = metricsData?.aggregates;
  const funnelSteps = metricsData?.funnelSteps || [];
  const campaigns = metricsData?.campaigns || [];
  const error = metricsData?.error;

  const funnelChartData = useMemo(() => {
    return funnelSteps.map((step, idx) => ({
      name: step.name,
      value: step.value,
      color: COLORS[idx % COLORS.length]
    }));
  }, [funnelSteps]);

  const isSmartlead = useMemo(() => {
    return campaigns.some(c => c.type === 'Cold Outreach') || 
      ["PlayIQ", "Billionaire Brother", "The Billionaire Brother", "Father Figure Formula"].some(n => 
        clientName.toLowerCase().includes(n.toLowerCase())
      );
  }, [campaigns, clientName]);

  return (
    <AnalyticsPageLayout
      clientId={clientId}
      clientName={clientName}
      clientLogo={clientLogo}
      pageName="Email Campaign Analytics"
      pageDescription="Real-time newsletter performance, delivery funnels, and link clicks"
      isLoading={false}
    >
      <div className="space-y-6">
        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {isSmartlead ? "Smartlead Cold Outreach" : "Sienvi Sender Connected"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {isSmartlead ? "• Live cold campaign metrics & sequences" : "• Live metrics from Resend engine"}
            </span>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="gap-2 h-9 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all self-end"
          >
            <RefreshCw className={`h-4 w-4 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Sync Live Data'}
          </Button>
        </div>

        {/* Error / Offline Alert */}
        {error && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-300">Offline Fallback Mode</h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Could not reach Sienvi Sender server (details: {error}). Displaying local database cache or static placeholders.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {aggregates ? (
          <>
            {/* Zone 1: KPI Stats Panel */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="hover:shadow-md transition-shadow border-blue-500/20 bg-card/65 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Emails Sent</CardTitle>
                  <Send className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    {aggregates.totalSent.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Sent this reporting cycle</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow border-emerald-500/20 bg-card/65 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {aggregates.deliveryRate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Success rate from Smartlead</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow border-violet-500/20 bg-card/65 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Open Rate</CardTitle>
                  <Eye className="h-4 w-4 text-violet-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight text-violet-600 dark:text-violet-400">
                    {aggregates.openRate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Industry benchmark is ~21%</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow border-pink-500/20 bg-card/65 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-pink-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight text-pink-600 dark:text-pink-400">
                    {aggregates.clickRate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Campaign click-to-open ratio</p>
                </CardContent>
              </Card>
            </div>

            {/* Zone 2: Funnel Pipeline & Insights */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Delivery Funnel Chart */}
              <Card className="lg:col-span-2 bg-card/75 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Delivery Funnel Pipeline
                  </CardTitle>
                  <CardDescription>Visual funnel drop-off from queued to links clicked</CardDescription>
                </CardHeader>
                <CardContent>
                  {funnelChartData.some(d => d.value > 0) ? (
                    <div className="h-[280px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelChartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
                          <Tooltip
                            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "12px",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                            }}
                            formatter={(val: number) => [`${val.toLocaleString()} emails`, 'Count']}
                          />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                            {funnelChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[280px] flex flex-col items-center justify-center text-center">
                      <Info className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No tracking funnel data available yet for this brand.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conversion Statistics & Optimization Nudges */}
              <Card className="bg-card/75 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Funnel Health</CardTitle>
                  <CardDescription>Performance assessments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl border bg-muted/30">
                    <h5 className="font-semibold text-sm">Audience Retention</h5>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Click-to-Open (CTOR):</span>
                      <span className="font-semibold text-foreground">
                        {aggregates.openRate > 0 ? ((aggregates.clickRate / aggregates.openRate) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                      <div 
                        className="h-full bg-primary transition-all" 
                        style={{ width: `${aggregates.openRate > 0 ? (aggregates.clickRate / aggregates.openRate) * 100 : 0}%` }} 
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border bg-muted/30">
                    <h5 className="font-semibold text-sm">Optimizations</h5>
                    <ul className="text-xs text-muted-foreground mt-2 space-y-2 list-disc pl-4">
                      {aggregates.openRate < 20 ? (
                        <li><strong className="text-foreground">Subject Lines:</strong> Open rate is below average. Try adding personalization variables or emotional hook words.</li>
                      ) : (
                        <li><strong className="text-foreground">Subject Lines:</strong> Exceptional open rates! Keep using similar tones and layouts.</li>
                      )}
                      {aggregates.clickRate < 3 ? (
                        <li><strong className="text-foreground">Call-To-Actions:</strong> CTR is low. Ensure buttons are placed above the fold and links are clearly highlighted.</li>
                      ) : (
                        <li><strong className="text-foreground">Link Clicks:</strong> Click rate is strong. Your current copy layout drives solid action.</li>
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Zone 3: Campaigns List Timeline */}
            <Card className="bg-card/75 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Sent Campaigns History</CardTitle>
                <CardDescription>Detailed log of recent email newsletters and sequences</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/80 text-xs text-muted-foreground font-semibold">
                          <th className="pb-3 pr-4">Campaign Title</th>
                          <th className="pb-3 px-4">Status</th>
                          <th className="pb-3 px-4">Type</th>
                          <th className="pb-3 px-4">Sent Date</th>
                          <th className="pb-3 px-4 text-right">Recipients</th>
                          <th className="pb-3 px-4 text-right">Delivered</th>
                          <th className="pb-3 px-4 text-right">Open Rate</th>
                          <th className="pb-3 pl-4 text-right">CTR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-sm">
                        {campaigns.map(c => {
                          return (
                            <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3.5 pr-4 font-medium max-w-[220px]">
                                <button 
                                  onClick={() => setSelectedCampaign(c)}
                                  className="text-left text-primary hover:underline font-semibold flex items-center gap-1.5 group/link truncate max-w-full"
                                  title="Click to view sequence and schedule details"
                                >
                                  <span className="truncate">{c.title}</span>
                                  <Sparkles className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-primary" />
                                </button>
                              </td>
                            <td className="py-3.5 px-4">
                              <Badge 
                                variant="secondary" 
                                className={
                                  c.status === 'Sent' 
                                    ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                                    : c.status === 'Scheduled' 
                                      ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                                      : c.status === 'Sending'
                                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse'
                                        : 'bg-muted text-muted-foreground'
                                }
                              >
                                {c.status}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground text-xs">{c.type}</td>
                            <td className="py-3.5 px-4 text-muted-foreground text-xs">
                              {c.sentDate ? format(new Date(c.sentDate), "MMM d, yyyy") : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right tabular-nums">{c.sentCount?.toLocaleString() ?? 0}</td>
                            <td className="py-3.5 px-4 text-right tabular-nums">{c.deliveredCount?.toLocaleString() ?? 0}</td>
                            <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-violet-600 dark:text-violet-400">{c.openRate}%</td>
                            <td className="py-3.5 pl-4 text-right tabular-nums font-semibold text-pink-600 dark:text-pink-400">{c.clickRate}%</td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No sent campaigns logged yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="py-24 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Synchronizing campaign metrics...</p>
          </div>
        )}
      </div>

      {/* Campaign Details Modal */}
      <Dialog open={!!selectedCampaign} onOpenChange={(open) => { if (!open) { setSelectedCampaign(null); setExpandedEmailIndex(0); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto gap-6 bg-card border shadow-lg rounded-2xl p-6 md:p-8">
          {selectedCampaign && (() => {
            const sequenceData = selectedCampaign.sequenceData;
            const emails = sequenceData?.emails || [];
            const schedules = sequenceData?.schedules || [];
            const recipients = sequenceData?.recipients || [];
            
            return (
              <>
                <DialogHeader className="border-b border-border/50 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <DialogTitle className="text-2xl font-heading font-bold text-foreground">
                        {selectedCampaign.title}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>Campaign ID: {selectedCampaign.id}</span>
                        <span>•</span>
                        <span>Type: {selectedCampaign.type}</span>
                      </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={
                          selectedCampaign.status === 'Sent' 
                            ? 'bg-green-500/10 text-green-600 border border-green-500/20 px-3 py-1 font-medium' 
                            : selectedCampaign.status === 'Scheduled' 
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20 px-3 py-1 font-medium' 
                              : selectedCampaign.status === 'Sending'
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-1 font-medium animate-pulse'
                                : 'bg-muted text-muted-foreground px-3 py-1 font-medium'
                        }
                      >
                        {selectedCampaign.status}
                      </Badge>
                      {sequenceData?.is_testing && (
                        <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20 px-3 py-1">
                          Test Mode
                        </Badge>
                      )}
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid gap-6 md:grid-cols-5">
                  {/* Left panel: Config & Audience */}
                  <div className="md:col-span-2 space-y-5">
                    {/* Sender Profile */}
                    <Card className="bg-muted/30 border-border/60">
                      <CardHeader className="py-3 px-4 flex flex-row items-center gap-2 space-y-0 border-b border-border/40 bg-muted/40">
                        <Send className="h-4 w-4 text-blue-500" />
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sender Identity</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground">From Address</label>
                          <p className="text-xs font-mono font-medium text-foreground bg-background border px-2 py-1 rounded mt-1 select-all truncate">
                            {currentSender.name} &lt;{currentSender.email}&gt;
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Reply-To Address</label>
                          <p className="text-xs font-mono font-medium text-foreground bg-background border px-2 py-1 rounded mt-1 select-all truncate">
                            {currentSender.replyTo}
                          </p>
                        </div>
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>{isSmartlead ? "Connected through Smartlead Outreach Engine" : "Verified domain under Resend engine"}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Audience segment & list */}
                    <Card className="bg-muted/30 border-border/60">
                      <CardHeader className="py-3 px-4 flex flex-row items-center gap-2 space-y-0 border-b border-border/40 bg-muted/40">
                        <User className="h-4 w-4 text-violet-500" />
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Recipients ({recipients.length})</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground">Target Count</label>
                          <p className="text-sm font-bold text-foreground mt-0.5">
                            {recipients.length.toLocaleString()} {recipients.length === 1 ? 'recipient' : 'recipients'}
                          </p>
                        </div>
                        {recipients.length > 0 ? (
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 block">Recipient List</label>
                            <div className="max-h-[140px] overflow-y-auto border rounded bg-background p-2 divide-y divide-border/30">
                              {recipients.map((r, i) => (
                                <div key={i} className="py-1 flex items-center justify-between text-xs gap-2">
                                  <span className="font-medium text-foreground truncate select-all">{r.email}</span>
                                  {r.name && <span className="text-[10px] text-muted-foreground shrink-0">{r.name}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 border border-dashed rounded bg-background">
                            <Inbox className="h-5 w-5 mx-auto text-muted-foreground/50 mb-1" />
                            <p className="text-xs text-muted-foreground">No explicit recipient details log</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right panel: Emails sequence timeline */}
                  <div className="md:col-span-3 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Sequence & Timeline ({emails.length} step{emails.length === 1 ? '' : 's'})
                      </h4>
                      {emails.length > 0 && recipients.length > 0 && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Planned sends: {(emails.length * recipients.length).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {emails.length > 0 ? (
                      <div className="relative pl-4 border-l border-border/80 ml-2 space-y-4">
                        {emails.map((email, i) => {
                          const isExpanded = expandedEmailIndex === i;
                          const scheduleStr = schedules[i];
                          const formattedSchedule = scheduleStr 
                            ? format(new Date(scheduleStr), "MMM d, yyyy 'at' h:mm a")
                            : "Sent immediately / No delay";
                          
                          // Determine if step is sent or scheduled
                          const isStepScheduled = selectedCampaign.status === 'Scheduled' || 
                            !!(scheduleStr && new Date(scheduleStr) > new Date());
                          const stepStatus = isStepScheduled ? 'Scheduled' : 'Sent';

                          return (
                            <div key={i} className="relative group">
                              {/* Timeline indicator node */}
                              <div className={`absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 bg-background z-10 flex items-center justify-center transition-all ${
                                stepStatus === 'Sent' 
                                  ? 'border-green-500 scale-100 group-hover:scale-110' 
                                  : 'border-blue-500 scale-100 group-hover:scale-110'
                              }`} />

                              <Card className={`border transition-all duration-300 ${
                                isExpanded ? 'border-primary shadow-sm bg-card' : 'border-border/60 bg-card/40 hover:bg-card hover:border-border'
                              }`}>
                                <div 
                                  className="p-4 cursor-pointer flex items-start justify-between gap-4 select-none"
                                  onClick={() => setExpandedEmailIndex(isExpanded ? null : i)}
                                >
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                        EMAIL #{i + 1}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3 shrink-0" />
                                        {formattedSchedule}
                                      </span>
                                      <Badge 
                                        variant="outline" 
                                        className={`px-1.5 py-0 text-[10px] border font-medium ${
                                          stepStatus === 'Sent' 
                                            ? 'bg-green-500/5 text-green-600 border-green-500/10' 
                                            : 'bg-blue-500/5 text-blue-600 border-blue-500/10'
                                        }`}
                                      >
                                        {stepStatus}
                                      </Badge>
                                    </div>
                                    <h5 className="font-semibold text-sm text-foreground truncate pr-2">
                                      {email.subject}
                                    </h5>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </div>

                                {isExpanded && (
                                  <CardContent className="px-4 pb-4 pt-0 border-t border-border/30 bg-muted/5">
                                    <div className="pt-3 space-y-3">
                                      {email.previewText && (
                                        <div>
                                          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Preview Text:</span>
                                          <p className="text-xs text-foreground italic mt-0.5 pl-2 border-l border-primary/20">
                                            {email.previewText}
                                          </p>
                                        </div>
                                      )}
                                      <div>
                                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">Email Body:</span>
                                        {/* Styled body copy wrapper */}
                                        <div className="text-xs text-muted-foreground bg-background border rounded-lg p-3.5 mt-1 overflow-x-auto max-h-[250px] overflow-y-auto leading-relaxed shadow-inner">
                                          {email.body.includes('<p>') || email.body.includes('<div>') || email.body.includes('<html') ? (
                                            <div 
                                              dangerouslySetInnerHTML={{ __html: email.body }} 
                                              className="prose prose-sm dark:prose-invert max-w-none break-words"
                                            />
                                          ) : (
                                            <p className="whitespace-pre-wrap font-sans break-words">{email.body}</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
                        <Inbox className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">No sequence details logged for this campaign.</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AnalyticsPageLayout>
  );
};

export default EmailAnalyticsClient;
