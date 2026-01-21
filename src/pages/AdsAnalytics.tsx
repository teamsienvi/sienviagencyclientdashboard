import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import AdsAnalyticsSection from "@/components/AdsAnalyticsSection";
import { AnalyticsPageLayout } from "@/components/AnalyticsPageLayout";

const AdsAnalytics = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();

  const { data: client, isLoading } = useQuery({
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
      clientId={clientId || ""}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="Ads Analytics"
      pageDescription="Meta Ads & Google Ads Analytics"
      isLoading={isLoading}
    >
      <AdsAnalyticsSection clientId={clientId!} clientName={client?.name || ""} />
    </AnalyticsPageLayout>
  );
};

export default AdsAnalytics;
