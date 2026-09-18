"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { DashboardStats } from "@/components/DashboardStats";
import { Search, ClipboardList, Archive, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clientsData, type Client } from "@/data/clients";
import { WeeklyReviewModal } from "@/components/WeeklyReviewModal";
import { toast } from "sonner";

type DbClient = { id: string; name: string; supabase_url: string | null };
type ArchivedDbClient = { id: string; name: string; logo_url: string | null };
type MetricoolConfig = { client_id: string; platform: string };

interface DashboardClientShellProps {
  dbClients: DbClient[];
  archivedDbClients?: ArchivedDbClient[];
  metricoolConfigs: MetricoolConfig[];
}

export default function DashboardClientShell({ dbClients, archivedDbClients = [], metricoolConfigs }: DashboardClientShellProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());

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

  const handleArchive = async (clientId: string, clientName: string) => {
    if (archivingIds.has(clientId)) return;
    
    setArchivingIds(prev => new Set(prev).add(clientId));
    try {
      const res = await fetch("/api/clients/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, archived: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to archive client");
      }

      toast.success(`${clientName} has been archived`, {
        description: "You can restore it from the Archived Clients section below.",
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive client");
    } finally {
      setArchivingIds(prev => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  };

  const handleRestore = async (clientId: string, clientName: string) => {
    if (archivingIds.has(clientId)) return;
    
    setArchivingIds(prev => new Set(prev).add(clientId));
    try {
      const res = await fetch("/api/clients/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, archived: false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to restore client");
      }

      toast.success(`${clientName} has been restored`, {
        description: "The client is now visible in the Command Center.",
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore client");
    } finally {
      setArchivingIds(prev => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  };

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
                  onArchive={dbClientId ? () => handleArchive(dbClientId, client.name) : undefined}
                  isArchiving={dbClientId ? archivingIds.has(dbClientId) : false}
                />
              );
            })}
          </div>
        )}

        {/* ── Archived Clients Section ── */}
        {archivedDbClients.length > 0 && (
          <div className="mt-16">
            <button
              onClick={() => setArchivedOpen(!archivedOpen)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <Archive className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="font-semibold text-foreground">Archived Clients</span>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted-foreground/10 text-muted-foreground">
                  {archivedDbClients.length}
                </span>
              </div>
              {archivedOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
            </button>

            {archivedOpen && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {archivedDbClients.map((archivedClient) => (
                  <div
                    key={archivedClient.id}
                    className="relative rounded-xl border border-border/40 bg-card/50 p-5 opacity-70 hover:opacity-90 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      {archivedClient.logo_url ? (
                        <img
                          src={archivedClient.logo_url}
                          alt={archivedClient.name}
                          className="w-12 h-12 rounded-lg object-cover grayscale"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <span className="text-lg font-bold text-muted-foreground">
                            {archivedClient.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{archivedClient.name}</h3>
                        <p className="text-xs text-muted-foreground">Archived</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(archivedClient.id, archivedClient.name)}
                      disabled={archivingIds.has(archivedClient.id)}
                      className="w-full gap-2 font-medium border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <RotateCcw className={`h-4 w-4 text-primary ${archivingIds.has(archivedClient.id) ? "animate-spin" : ""}`} />
                      {archivingIds.has(archivedClient.id) ? "Restoring..." : "Restore to Command Center"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

