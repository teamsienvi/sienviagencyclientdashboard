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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 animate-fade-in">
      {statsData.map((stat, index) => (
        <div
          key={stat.label}
          className="group flex flex-col gap-3 bg-card border border-border/40 shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-primary/30 transition-all duration-300"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-[13px] font-semibold text-muted-foreground tracking-wide uppercase">
              {stat.label}
            </p>
          </div>
          <div>
            <p className="text-3xl font-heading font-bold text-foreground tracking-tight">
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
