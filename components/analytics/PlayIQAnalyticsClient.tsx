"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlayIQAnalyticsSection } from "@/components/dashboard/PlayIQAnalyticsSection";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

export default function PlayIQAnalyticsClient({ clientId }: { clientId: string }) {
  // Fetch client details
  const { data: client, isPending: isLoadingClient } = useQuery({
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
      pageName="Beta Testers Analytics"
      pageDescription="PlayIQ waitlist and beta intake data"
      isLoading={isLoadingClient}
    >
      <PlayIQAnalyticsSection clientId={clientId} />
    </AnalyticsPageLayout>
  );
}
