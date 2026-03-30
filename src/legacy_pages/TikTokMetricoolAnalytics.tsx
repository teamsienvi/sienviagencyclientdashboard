import { useParams } from "react-router-dom";
import { Music2 } from "lucide-react";
import { MetricoolAnalyticsSection } from "@/components/MetricoolAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsPageLayout } from "@/components/AnalyticsPageLayout";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const TikTokMetricoolAnalytics = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId) return;
      
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("id", clientId)
        .maybeSingle();

      if (!error && data) {
        setClient(data);
      }
      setLoading(false);
    };

    fetchClient();
  }, [clientId]);

  return (
    <AnalyticsPageLayout
      clientId={clientId || ""}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="TikTok Analytics"
      pageDescription="TikTok Analytics (via Metricool)"
      isLoading={loading}
    >
      <MetricoolAnalyticsSection 
        clientId={clientId || ""} 
        clientName={client?.name || ""}
        platform="tiktok"
        platformIcon={<Music2 className="h-5 w-5" />}
        platformColor="text-pink-500"
      />
    </AnalyticsPageLayout>
  );
};

export default TikTokMetricoolAnalytics;
