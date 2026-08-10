"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RefreshCw, Users, QrCode, Download,
  ArrowUpRight, MessageCircle, Package,
  Loader2, Cat, Zap, ShoppingCart, Eye, Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSyncState } from "@/hooks/useSyncState";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";

interface MelCatAnalyticsSectionProps {
  clientId: string;
  clientName: string;
}

const MelCatAnalyticsSection = ({ clientId, clientName }: MelCatAnalyticsSectionProps) => {
  const syncState = useSyncState(clientId, "melcat", "analytics");

  const { data: cachedData, isLoading: isCacheLoading } = useQuery({
    queryKey: ["platform-analytics-cache", clientId, "melcat", "analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_analytics_cache" as any)
        .select("data")
        .eq("client_id", clientId)
        .eq("platform", "melcat")
        .eq("module", "analytics")
        .maybeSingle();

      if (error) throw error;
      return ((data as any)?.data as any) ?? null;
    },
    enabled: !!clientId && (!syncState.isSyncing || syncState.isDegraded),
  });

  const loading = isCacheLoading || (syncState.isSyncing && !cachedData);
  const refreshing = syncState.isSyncing;

  const core = cachedData?.core;
  const funnel = cachedData?.funnel;
  const qrCampaigns = cachedData?.qrCampaigns || [];
  const upgradePerf = cachedData?.upgradePerformance || [];
  const drops = cachedData?.drops || [];
  const amazon = cachedData?.amazon;
  const tiers = cachedData?.tiers || [];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Cat className="h-5 w-5 text-orange-500" />
          <h2 className="text-xl font-bold">MelCat Digital Products</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!cachedData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Cat className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">MelCat Analytics</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No digital product data synced yet. Click below to sync MelCat metrics.
          </p>
          <Button onClick={() => syncState.retry()} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Now
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10">
            <Cat className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">MelCat Digital Products</h2>
            <p className="text-xs text-muted-foreground">
              MelCat is Snarky Pets' Shopify app that powers Big Mel — a digital collectible ecosystem where customers unlock content packs, chat with an AI cat, and upgrade through tiers.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cachedData?.syncedAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Last synced: {new Date(cachedData.syncedAt).toLocaleString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncState.retry()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Two-column summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Customers & Engagement */}
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Customers & Engagement
            </CardTitle>
            <CardDescription className="text-xs">
              Customers who claimed a Big Mel digital pack. Entitlements are the individual content packs they've unlocked. Library views and downloads track how often they access their content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-2xl font-bold">{core?.totalCustomers?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{core?.activeEntitlements?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground">Active Entitlements</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{core?.libraryViews?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground">Library Views</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{core?.assetDownloads?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground">Asset Downloads</p>
              </div>
            </div>

            {/* Big Mel Chat inline */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <MessageCircle className="h-4 w-4 text-orange-500" />
              <div>
                <span className="font-semibold">{core?.totalChats || 0}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  Big Mel chats ({core?.uniqueChatSessions || 0} sessions)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Funnel */}
        <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-500" />
              Upgrade Funnel
            </CardTitle>
            <CardDescription className="text-xs">
              Tracks customers moving from free packs to paid tiers (Standard → Deluxe → Ultimate). Upgrade clicks are CTA taps in the content library; purchases are completed Shopify checkouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-2xl font-bold">{core?.upgradeClicks?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground">Upgrade Clicks</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{core?.upgradePurchases?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground">Purchases</p>
              </div>
            </div>

            {/* Funnel conversion inline */}
            {funnel && (
              <div className="space-y-2 pt-2 border-t">
                <FunnelRow label="Library → Upgrade Click" rate={funnel.libraryToUpgradeClick} />
                <FunnelRow label="Click → Purchase" rate={funnel.clickToPurchase} />
              </div>
            )}

            {/* Free-to-paid */}
            {core?.freeToPaidConversionRate && core.freeToPaidConversionRate !== "0.0%" && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  Free → Paid: <span className="font-semibold">{core.freeToPaidConversionRate}</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amazon Physical-to-Digital Bridge */}
        {amazon && (amazon.totalOrders > 0 || amazon.totalClaims > 0) && (
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500" />
                Amazon Physical → Digital
              </CardTitle>
              <CardDescription className="text-xs">
                Customers who buy physical Snarky Pets products on Amazon can scan a QR code in the packaging to claim free Big Mel digital content. This tracks how many Amazon orders have been linked.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold">{amazon.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Seeded Orders</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{amazon.claimedOrders}</p>
                  <p className="text-xs text-muted-foreground">Claimed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {amazon.totalOrders > 0 
                      ? ((amazon.claimedOrders / amazon.totalOrders) * 100).toFixed(1) + "%" 
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Claim Rate</p>
                </div>
              </div>
              {(amazon.pendingClaims > 0) && (
                <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                    {amazon.pendingClaims} pending
                  </Badge>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
                    {amazon.approvedClaims} approved
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Free Product Claims */}
        {(core?.tunnelsClaimed > 0 || core?.cubesClaimed > 0) && (
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-rose-500" />
                Free Tier Claims
              </CardTitle>
              <CardDescription className="text-xs">
                Free digital products given to new customers as an onboarding hook — Tunnels (animated wallpapers) and Cubes (3D collectible renders).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold">{core.tunnelsClaimed}</p>
                  <p className="text-xs text-muted-foreground">Tunnels</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{core.cubesClaimed}</p>
                  <p className="text-xs text-muted-foreground">Cubes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Detail Accordions (collapsed by default) ── */}
      {(qrCampaigns.length > 0 || upgradePerf.length > 0 || drops.length > 0 || tiers.length > 0) && (
        <Accordion type="multiple" className="space-y-2">
          {/* QR Campaigns */}
          {qrCampaigns.length > 0 && (
            <AccordionItem value="qr-campaigns" className="border rounded-xl px-1 bg-card/80 backdrop-blur-sm shadow-sm">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-violet-500" />
                  <span className="font-semibold text-sm">QR Campaigns ({qrCampaigns.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Hash</th>
                        <th className="pb-2 font-medium">Pack</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Redemptions</th>
                        <th className="pb-2 font-medium text-right">Unique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qrCampaigns.map((c: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-mono text-xs">{c.campaignHash?.substring(0, 12)}…</td>
                          <td className="py-2">{c.packName}</td>
                          <td className="py-2">
                            <Badge variant={c.isActive ? "default" : "secondary"} className={cn("text-xs", c.isActive ? "bg-green-500/10 text-green-600" : "")}>
                              {c.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">{c.redemptions}</td>
                          <td className="py-2 text-right">{c.uniqueCustomers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Upgrade Performance */}
          {upgradePerf.length > 0 && (
            <AccordionItem value="upgrade-perf" className="border rounded-xl px-1 bg-card/80 backdrop-blur-sm shadow-sm">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-sm">Upgrade Performance by Tier</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 font-medium">Tier</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">Purchases</th>
                        <th className="pb-2 font-medium text-right">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upgradePerf.map((u: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{u.tier}</td>
                          <td className="py-2 text-right">{u.clicks}</td>
                          <td className="py-2 text-right">{u.purchases}</td>
                          <td className="py-2 text-right">
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">
                              {u.conversion}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Digital Tiers */}
          {tiers.length > 0 && (
            <AccordionItem value="tiers" className="border rounded-xl px-1 bg-card/80 backdrop-blur-sm shadow-sm">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold text-sm">Digital Tiers ({tiers.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {tiers.map((t: any, i: number) => {
                    const tierColors = [
                      "bg-blue-500/10 border-blue-500/20",
                      "bg-green-500/10 border-green-500/20",
                      "bg-violet-500/10 border-violet-500/20",
                      "bg-amber-500/10 border-amber-500/20",
                    ];
                    return (
                      <div key={i} className={cn("text-center p-3 rounded-lg border", tierColors[i % tierColors.length])}>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">Level {t.level}</p>
                        <p className="text-lg font-bold mt-1">{t.packCount}</p>
                        <p className="text-xs text-muted-foreground">packs</p>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}
    </div>
  );
};

// ── Funnel row ──
function FunnelRow({ label, rate }: { label: string; rate: string }) {
  const numRate = parseFloat(rate);
  const color = numRate > 0 ? "text-indigo-600 bg-indigo-500/10" : "text-muted-foreground bg-muted/50";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("px-2 py-0.5 rounded font-semibold text-xs", color)}>
        {rate}
      </span>
    </div>
  );
}

export default MelCatAnalyticsSection;
