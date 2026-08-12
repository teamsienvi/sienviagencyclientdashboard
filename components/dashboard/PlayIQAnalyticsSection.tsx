"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Truck, Activity, Filter, ExternalLink, Cpu } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { format } from "date-fns";

interface PlayIQAnalyticsSectionProps {
  clientId: string;
}

export function PlayIQAnalyticsSection({ clientId }: PlayIQAnalyticsSectionProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["playiq-analytics", clientId],
    queryFn: async () => {
      const res = await fetch("/api/playiq/analytics");
      if (!res.ok) {
        throw new Error("Failed to fetch PlayIQ analytics");
      }
      return res.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 border border-red-500/30 bg-red-500/5 rounded-xl text-center">
        <p className="text-red-400 font-medium">Unable to load PlayIQ Beta Analytics.</p>
        <p className="text-sm text-slate-500 mt-2">Check API configuration and database connection.</p>
      </div>
    );
  }

  const { metrics, applications } = data;

  return (
    <div className="space-y-8">
      {/* HUD Modules */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Capacity */}
        <div className="rounded-xl p-6 border-l-[3px] border-l-[#00c8ff] bg-card border shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-[#00c8ff]"><Users className="w-5 h-5" /></div>
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Beta Intake Capacity</p>
          </div>
          <div>
            <p className="text-4xl font-black">{metrics.totalCount} <span className="text-sm text-muted-foreground font-normal">/ 50</span></p>
          </div>
        </div>
        
        {/* Orders Pending */}
        <div className="rounded-xl p-6 border-b-[3px] border-b-amber-400 bg-card border shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-amber-400"><Truck className="w-5 h-5" /></div>
            <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Orders Pending</p>
          </div>
          <div>
            <p className="text-4xl font-black">{metrics.paidCount}</p>
          </div>
        </div>

        {/* Traffic Source */}
        <div className="rounded-xl p-6 border-t-[3px] border-t-emerald-400 bg-card border shadow-sm flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="text-emerald-400"><Activity className="w-5 h-5" /></div>
              <p className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Traffic Source</p>
            </div>
            <div className="mt-2 space-y-1 font-mono text-xs">
              <div className="flex justify-between items-center group relative">
                <span className="text-muted-foreground">EMAIL:</span>
                <span className="text-emerald-500 font-bold dark:text-emerald-400">{metrics.sourceBreakdown.emailCount}</span>
              </div>
              <div className="flex justify-between items-center group relative">
                <span className="text-muted-foreground">SOCIAL:</span>
                <span className="text-[#00c8ff] font-bold">{metrics.sourceBreakdown.socialCount}</span>
              </div>
              <div className="flex justify-between items-center group relative">
                <span className="text-muted-foreground">OTHER:</span>
                <span className="font-bold">{metrics.sourceBreakdown.otherCount}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-border/50 text-[10px] text-muted-foreground/70 leading-tight">
            <span className="block mb-0.5"><strong>Email:</strong> Newsletter or CRM clicks.</span>
            <span className="block mb-0.5"><strong>Social:</strong> Meta, TikTok, or Ad campaigns.</span>
            <span className="block"><strong>Other:</strong> Direct link visits or Organic Search.</span>
          </div>
        </div>

        {/* LMS Console */}
        <div className="rounded-xl p-6 border-r-[3px] border-r-[#7b4fce] bg-[rgba(123,79,206,0.03)] border shadow-sm flex flex-col justify-between h-full">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              <div className="text-[#7b4fce]"><Cpu className="w-5 h-5 animate-pulse" /></div>
              <div>
                <p className="text-xs font-mono tracking-widest text-[#7b4fce] uppercase">External System</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <a href="https://weplayiq.com" target="_blank" rel="noopener noreferrer" className="block text-center w-full bg-[#00c8ff] hover:bg-white hover:text-black text-black py-3 font-bold uppercase tracking-[0.2em] transition-colors shadow-[0_0_15px_rgba(0,200,255,0.6)] rounded-sm text-sm">
              WEPLAYIQ.COM &rarr;
            </a>
          </div>
        </div>
      </div>

      {/* Database Table */}
      <div className="rounded-xl overflow-hidden border bg-card">
        <div className="px-6 py-4 border-b bg-muted/50 flex justify-between items-center">
          <h2 className="font-mono text-sm tracking-widest text-[#00c8ff] uppercase">&gt; COHORT_TABLE_MANIFEST</h2>
        </div>
        
        {applications && applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-mono">
              <thead className="text-[10px] text-muted-foreground uppercase tracking-widest bg-muted/20 border-b">
                <tr>
                  <th className="px-6 py-4">Applicant (Parent)</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Child Profile</th>
                  <th className="px-6 py-4">Traffic Source</th>
                  <th className="px-6 py-4">Application Status</th>
                  <th className="px-6 py-4">Date applied</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app: any) => (
                  <tr key={app.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs text-muted-foreground"><Users className="w-3 h-3" /></div>
                      {app.parent_full_name || 'Unknown Parent'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs font-sans">
                      <a href={`mailto:${app.email}`} className="hover:text-primary transition-colors">{app.email}</a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00c8ff]/10 text-[#00c8ff] border border-[#00c8ff]/20">
                        <span className="text-xs font-bold">{app.child_age_band || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-[10px] uppercase font-bold tracking-widest border border-muted bg-muted/50 rounded-sm">
                        {app.source === 'web_form' || !app.source ? 'direct_traffic' : app.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-widest rounded-sm
                        ${app.status === 'paid' ? 'text-emerald-600 border border-emerald-400 bg-emerald-400/10 dark:text-emerald-400' : ''}
                        ${app.status === 'checkout_started' ? 'text-amber-600 border border-amber-400 bg-amber-400/10 dark:text-amber-400' : ''}
                        ${app.status === 'canceled' ? 'text-red-600 border border-red-400 bg-red-400/10 dark:text-red-400' : ''}
                        ${app.status === 'pending' ? 'text-slate-600 border border-slate-300 bg-slate-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400' : ''}
                        ${app.status === 'fulfilled' ? 'text-[#00c8ff] border border-[#00c8ff] bg-[#00c8ff]/10' : ''}
                        ${app.status === 'fulfilled_promo' ? 'text-[#7b4fce] border border-[#7b4fce] bg-[#7b4fce]/10' : ''}
                      `}>
                        {app.status === 'checkout_started' ? 'Processing' : app.status === 'fulfilled_promo' ? 'promo' : app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs tracking-wider">
                      {format(new Date(app.created_at), 'MMM d, yyyy - h:mm a')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center font-mono">
            <Filter className="w-8 h-8 text-[#7b4fce] mb-4 opacity-50" />
            <p className="uppercase tracking-widest text-xs">0 Records Retrieved.</p>
          </div>
        )}
      </div>
    </div>
  );
}
