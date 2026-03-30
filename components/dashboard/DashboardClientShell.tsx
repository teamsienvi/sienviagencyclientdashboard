"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { DashboardStats } from "@/components/DashboardStats";
import { ClientSearch } from "@/components/ClientSearch";
import { clientsData, type Client } from "@/data/clients";

type DbClient = { id: string; name: string; supabase_url: string | null };
type MetricoolConfig = { client_id: string; platform: string };

interface DashboardClientShellProps {
  dbClients: DbClient[];
  metricoolConfigs: MetricoolConfig[];
}

export default function DashboardClientShell({ dbClients, metricoolConfigs }: DashboardClientShellProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
      
      <main className="container mx-auto px-6 py-16">
        <div className="mb-8 animate-slide-up">
          <h2 className="text-4xl font-heading font-bold text-foreground mb-3">Client Dashboard</h2>
          <p className="text-muted-foreground text-lg">Access your weekly KPI reports and analytics</p>
        </div>
        
        <DashboardStats />
        
        <ClientSearch value={searchQuery} onChange={setSearchQuery} />
        
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
