"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { AmazonOrdersCard } from "@/components/AmazonOrdersCard";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

export default function AmazonOrdersAnalyticsPage({ clientId }: { clientId: string }) {
  const supabase = createClient();
  
  const { data: client, isPending } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  return (
    <AnalyticsPageLayout
      clientId={clientId}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="Amazon Orders"
      pageDescription="Daily Sales & Traffic Report"
      isLoading={isPending}
    >
      <div className="space-y-6">
        <AmazonOrdersCard
          clientId={clientId}
          clientName={client?.name || ""}
        />
      </div>
    </AnalyticsPageLayout>
  );
}
