import { ExternalLink } from "lucide-react";
import { Client } from "@/data/clients";

interface ClientCardProps {
  client: Client;
}

export const ClientCard = ({ client }: ClientCardProps) => {
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
            <div key={index} className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">{report.dateRange}</span>
              <a
                href={report.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
              >
                View Report
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
