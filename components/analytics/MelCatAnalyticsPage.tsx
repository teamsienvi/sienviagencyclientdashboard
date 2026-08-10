"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MelCatAnalyticsSection from "@/components/MelCatAnalyticsSection";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

export default function MelCatAnalyticsPage({ clientId }: { clientId: string }) {
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
      pageName="MelCat Digital Products"
      pageDescription="Big Mel digital ecosystem — packs, QR campaigns, upgrades, drops"
      isLoading={isPending}
    >
      <div className="space-y-6">
        <MelCatAnalyticsSection
          clientId={clientId}
          clientName={client?.name || ""}
        />
      </div>
    </AnalyticsPageLayout>
  );
}
