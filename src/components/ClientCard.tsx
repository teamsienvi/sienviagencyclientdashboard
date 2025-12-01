import { ChevronRight } from "lucide-react";
import { Client } from "@/data/clients";
import { Link } from "react-router-dom";

interface ClientCardProps {
  client: Client;
  clientIndex: number;
}

export const ClientCard = ({ client, clientIndex }: ClientCardProps) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-sm transition-shadow">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{client.name}</h3>
          <p className="text-xs font-medium text-primary uppercase tracking-wide mt-1">
            WEEKLY REPORTS
          </p>
        </div>
        
        <div className="space-y-3">
          {client.reports.map((report, index) => (
            <Link
              key={index}
              to={`/report/${clientIndex}/${index}`}
              className="flex items-center justify-between py-2 hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors group"
            >
              <span className="text-sm text-muted-foreground">{report.dateRange}</span>
              <span className="text-sm font-medium text-primary group-hover:text-primary/80 transition-colors flex items-center gap-1.5">
                View Report
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
