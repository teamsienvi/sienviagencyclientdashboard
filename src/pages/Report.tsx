import { useParams, useNavigate } from "react-router-dom";
import { clientsData } from "@/data/clients";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Report Not Found</h1>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
              <p className="text-sm text-muted-foreground">{report.dateRange}</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        <iframe
          src={report.link}
          className="w-full h-full min-h-[calc(100vh-73px)]"
          title={`${client.name} - ${report.dateRange}`}
          frameBorder="0"
        />
      </main>
    </div>
  );
};

export default Report;
