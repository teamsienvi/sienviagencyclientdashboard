import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { DashboardStats } from "@/components/DashboardStats";
import { ClientSearch } from "@/components/ClientSearch";
import { clientsData } from "@/data/clients";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch database clients to get their IDs
  const { data: dbClients } = useQuery({
    queryKey: ["clients-for-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, supabase_url")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
  
  // Map client names to their database IDs (for YouTube analytics)
  const clientIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbClients?.forEach((client) => {
      map[client.name] = client.id;
    });
    return map;
  }, [dbClients]);

  // Map client names to their database IDs (only those with website analytics configured)
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
    return clientsData.filter(client =>
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
            {filteredClients.map((client, index) => (
              <ClientCard 
                key={client.name} 
                client={client} 
                clientIndex={index} 
                clientId={clientIdMap[client.name]}
                websiteAnalyticsId={websiteAnalyticsMap[client.name]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
