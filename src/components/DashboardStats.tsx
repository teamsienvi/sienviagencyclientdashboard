import { Users, FileText, Clock } from "lucide-react";
import { clientsData } from "@/data/clients";

export const DashboardStats = () => {
  const totalClients = clientsData.length;
  const totalReports = clientsData.reduce((acc, client) => acc + client.reports.length, 0);
  
  // Get the latest report - it's always the last report of the first client (since all clients have same weeks)
  const latestReport = clientsData[0]?.reports[clientsData[0].reports.length - 1];

  const stats = [
    {
      label: "Total Clients",
      value: totalClients,
      icon: Users,
    },
    {
      label: "Total Reports",
      value: totalReports,
      icon: FileText,
    },
    {
      label: "Latest Update",
      value: latestReport?.dateRange || "N/A",
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 animate-fade-in">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="group flex items-center gap-4 bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/20 transition-all duration-300"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
            <stat.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-xl font-heading font-semibold text-foreground">
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
