import { Users, FileText, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentReportingWeek } from "@/utils/weeklyDateRange";

export const DashboardStats = () => {
  // Fetch real stats from database
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      // Fetch total active clients
      const { count: clientCount, error: clientError } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (clientError) throw clientError;

      // Fetch total reports
      const { count: reportCount, error: reportError } = await supabase
        .from("reports")
        .select("*", { count: "exact", head: true });

      if (reportError) throw reportError;

      // Get the current reporting week instead of relying on stale report generations
      const { dateRange } = getCurrentReportingWeek();

      return {
        totalClients: clientCount || 0,
        totalReports: reportCount || 0,
        latestUpdate: dateRange,
      };
    },
  });

  const statsData = [
    {
      label: "Total Clients",
      value: stats?.totalClients ?? 0,
      icon: Users,
    },
    {
      label: "Total Reports",
      value: stats?.totalReports ?? 0,
      icon: FileText,
    },
    {
      label: "Latest Update",
      value: stats?.latestUpdate ?? "N/A",
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 animate-fade-in">
      {statsData.map((stat, index) => (
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
