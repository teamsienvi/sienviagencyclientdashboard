"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { DashboardStats } from "@/components/DashboardStats";
import { ClientSearch } from "@/components/ClientSearch";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { clientsData, type Client } from "@/data/clients";
import { WeeklyReviewModal } from "@/components/WeeklyReviewModal";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

type DbClient = { id: string; name: string; supabase_url: string | null };
type MetricoolConfig = { client_id: string; platform: string };

interface DashboardClientShellProps {
  dbClients: DbClient[];
  metricoolConfigs: MetricoolConfig[];
}

export default function DashboardClientShell({ dbClients, metricoolConfigs }: DashboardClientShellProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  const clientIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbClients?.forEach((client) => {
      map[client.name] = client.id;
    });
    return map;
  }, [dbClients]);

  const metricoolPlatformsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    metricoolConfigs?.forEach((config) => {
      if (!map[config.client_id]) {
        map[config.client_id] = [];
      }
      map[config.client_id].push(config.platform);
    });
    return map;
  }, [metricoolConfigs]);

  const websiteAnalyticsMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbClients?.forEach((client) => {
      if (client.supabase_url) {
        map[client.name] = client.id;
      }
    });
    return map;
  }, [dbClients]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clientsData;
    return clientsData.filter((client: Client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Header />
      <WeeklyReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
      
      <main className="container mx-auto px-6 py-12 max-w-[1400px]">
        <div className="mb-10 animate-slide-up flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-3 tracking-tight">Agency Command Center</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">Monitor active client portfolios, track generative analytics insights, and manage weekly reporting schedules.</p>
          </div>
          <div className="flex flex-row items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewOpen(true)}
              className="gap-2 h-9 flex-shrink-0 font-medium border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <ClipboardList className="w-4 h-4 text-primary" />
              Weekly Review
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 w-52 bg-card border-border focus:border-primary/50 transition-all duration-300"
              />
            </div>
          </div>
        </div>
        
        <DashboardStats />
        
        {filteredClients.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <p className="text-muted-foreground text-lg">No clients found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredClients.map((client: Client, index: number) => {
              const dbClientId = clientIdMap[client.name];
              return (
                <ClientCard 
                  key={client.name} 
                  client={client} 
                  clientIndex={index} 
                  clientId={dbClientId}
                  websiteAnalyticsId={websiteAnalyticsMap[client.name]}
                  metricoolPlatforms={dbClientId ? metricoolPlatformsMap[dbClientId] : undefined}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
