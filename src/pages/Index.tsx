import { Header } from "@/components/Header";
import { ClientCard } from "@/components/ClientCard";
import { clientsData } from "@/data/clients";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-16">
        <div className="mb-12 animate-slide-up">
          <h2 className="text-4xl font-heading font-bold text-foreground mb-3">Client Dashboard</h2>
          <p className="text-muted-foreground text-lg">Access your weekly KPI reports and analytics</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {clientsData.map((client, index) => (
            <ClientCard key={index} client={client} clientIndex={index} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
