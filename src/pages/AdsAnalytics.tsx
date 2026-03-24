import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MetaAdsManagerReport from "@/components/MetaAdsManagerReport";
import AdsAnalyticsSection from "@/components/AdsAnalyticsSection";
import { AnalyticsPageLayout } from "@/components/AnalyticsPageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdsShredderCard } from "@/components/AdsShredderCard";

const AdsAnalytics = () => {
  const { clientId } = useParams<{ clientId: string }>();

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

  // Check if client has Meta Ads configured
  const { data: metaAdsConfig } = useQuery({
    queryKey: ["client-meta-ads-config", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("client_meta_ads_config")
        .select("*")
        .eq("client_id", clientId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!clientId,
  });

  const hasMetaAds = !!metaAdsConfig;

  return (
    <AnalyticsPageLayout
      clientId={clientId || ""}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="Ads Analytics"
      pageDescription="Meta Ads & Google Ads Analytics"
      isLoading={isLoading}
    >
      {hasMetaAds ? (
        <>
          <Tabs defaultValue="meta-ads" className="space-y-4">
            <TabsList>
              <TabsTrigger value="meta-ads">Meta Ads</TabsTrigger>
              <TabsTrigger value="google-ads" disabled>
                Google Ads
                <span className="ml-1.5 text-[10px] text-muted-foreground">(Coming soon)</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="meta-ads">
              <MetaAdsManagerReport clientId={clientId!} clientName={client?.name || ""} />
            </TabsContent>
            <TabsContent value="google-ads">
              <Card className="border-dashed">
                <CardHeader className="text-center py-12">
                  <CardTitle className="text-lg text-muted-foreground">Google Ads Coming Soon</CardTitle>
                  <CardDescription>
                    Google Ads integration will be available in a future update.
                  </CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
          <div className="space-y-4">
            <AdsShredderCard clientId={clientId!} adPlatform="meta" title="Ads Shredder — Meta/Facebook Ads" />
            <AdsShredderCard clientId={clientId!} adPlatform="google" title="Ads Shredder — Google Ads" />
          </div>
        </>
      ) : (
        <AdsAnalyticsSection clientId={clientId!} clientName={client?.name || ""} />
      )}
    </AnalyticsPageLayout>
  );
};

export default AdsAnalytics;
