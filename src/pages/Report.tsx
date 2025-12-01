import { useParams, useNavigate } from "react-router-dom";
import { clientsData } from "@/data/clients";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";

const Report = () => {
  const { clientId, reportId } = useParams();
  const navigate = useNavigate();
  
  const clientIndex = parseInt(clientId || "0");
  const reportIndex = parseInt(reportId || "0");
  
  const client = clientsData[clientIndex];
  const report = client?.reports[reportIndex];
  
  if (!client || !report) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-4">Report Not Found</h1>
          <Button onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">{client.name}</h1>
            <p className="text-muted-foreground font-medium">Week of {report.dateRange}</p>
          </div>
          <Button 
            onClick={() => navigate("/")} 
            variant="outline" 
            className="gap-2 hover:bg-primary/5 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm animate-fade-in">
          <iframe
            src={report.link}
            className="w-full h-[calc(100vh-250px)] min-h-[600px]"
            title={`${client.name} - ${report.dateRange}`}
            frameBorder="0"
          />
        </div>
      </main>
    </div>
  );
};

export default Report;
