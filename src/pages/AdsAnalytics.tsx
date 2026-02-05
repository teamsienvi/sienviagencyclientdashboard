import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import AdsAnalyticsSection from "@/components/AdsAnalyticsSection";
import DirectMetaAdsSection from "@/components/DirectMetaAdsSection";
import { AnalyticsPageLayout } from "@/components/AnalyticsPageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Check if this is BlingyBag (has direct Meta Ads access)
  const isBlingyBag = client?.name?.toLowerCase().includes('blingybag');

  return (
    <AnalyticsPageLayout
      clientId={clientId || ""}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="Ads Analytics"
      pageDescription="Meta Ads & Google Ads Analytics"
      isLoading={isLoading}
    >
      {isBlingyBag ? (
        <Tabs defaultValue="direct" className="space-y-6">
          <TabsList>
            <TabsTrigger value="direct">Direct Meta API</TabsTrigger>
            <TabsTrigger value="metricool">Via Metricool</TabsTrigger>
          </TabsList>
          <TabsContent value="direct">
            <DirectMetaAdsSection clientId={clientId!} clientName={client?.name || ""} />
          </TabsContent>
          <TabsContent value="metricool">
            <AdsAnalyticsSection clientId={clientId!} clientName={client?.name || ""} />
          </TabsContent>
        </Tabs>
      ) : (
        <AdsAnalyticsSection clientId={clientId!} clientName={client?.name || ""} />
      )}
    </AnalyticsPageLayout>
  );
};

export default AdsAnalytics;
