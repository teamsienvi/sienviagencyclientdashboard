import { ChevronRight } from "lucide-react";
import { Client } from "@/data/clients";
import { Link } from "react-router-dom";

interface ClientCardProps {
  client: Client;
  clientIndex: number;
}

export const ClientCard = ({ client, clientIndex }: ClientCardProps) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-fade-in group">
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-heading font-semibold text-foreground mb-1">{client.name}</h3>
          <p className="text-xs font-medium text-primary uppercase tracking-wider">
            Weekly Reports
          </p>
        </div>
        
        <div className="space-y-2">
          {client.reports.map((report, index) => (
            <Link
              key={index}
              to={report.isInternal ? report.link : `/report/${clientIndex}/${index}`}
              className="flex items-center justify-between py-3 px-3 hover:bg-accent/70 rounded-lg transition-all duration-200 group/item"
            >
              <span className="text-sm text-muted-foreground font-medium">{report.dateRange}</span>
              <span className="text-sm font-medium text-primary group-hover/item:translate-x-1 transition-transform duration-200 flex items-center gap-2">
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
