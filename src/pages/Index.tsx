import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { clientsData } from "@/data/clients";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Client Dashboard</h2>
          <p className="text-primary text-base">Access your weekly KPI reports and analytics</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientsData.map((client, index) => (
            <ClientCard key={index} client={client} clientIndex={index} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
