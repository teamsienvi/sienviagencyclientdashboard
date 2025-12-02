import { Client } from "@/data/clients";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, ExternalLink } from "lucide-react";

interface ClientCardProps {
  client: Client;
  clientIndex: number;
}

export const ClientCard = ({ client, clientIndex }: ClientCardProps) => {
  const navigate = useNavigate();
  
  const handleReportSelect = (value: string) => {
    const reportIndex = parseInt(value);
    const report = client.reports[reportIndex];
    
    if (report.isInternal) {
      navigate(report.link);
    } else {
      window.open(report.link, '_blank');
    }
  };

  // Get the most recent report for display
  const latestReport = client.reports[client.reports.length - 1];

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-fade-in group">
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-heading font-semibold text-foreground mb-1">{client.name}</h3>
          <p className="text-xs font-medium text-primary uppercase tracking-wider">
            {client.reports.length} Weekly Reports
          </p>
        </div>
        
        <div className="space-y-3">
          <Select onValueChange={handleReportSelect}>
            <SelectTrigger className="w-full bg-accent/50 border-border hover:bg-accent transition-colors">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <SelectValue placeholder="Select a report date" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {client.reports.map((report, index) => (
                <SelectItem 
                  key={index} 
                  value={index.toString()}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span>{report.dateRange}</span>
                    {!report.isInternal && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <p className="text-xs text-muted-foreground text-center">
            Latest: {latestReport.dateRange}
          </p>
        </div>
      </div>
    </div>
  );
};
