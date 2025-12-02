import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { DashboardStats } from "@/components/DashboardStats";
import { ClientSearch } from "@/components/ClientSearch";
import { clientsData } from "@/data/clients";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
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
              <ClientCard key={client.name} client={client} clientIndex={index} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
