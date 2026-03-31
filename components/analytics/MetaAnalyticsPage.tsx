"use client";

import MetaAnalyticsSection from "@/components/MetaAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

interface MetaAnalyticsPageProps {
  clientId: string;
}

const MetaAnalyticsPage = ({ clientId }: MetaAnalyticsPageProps) => {
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
      clientId={clientId}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="Meta Analytics"
      pageDescription="Meta Analytics (Instagram & Facebook)"
      isLoading={loading}
    >
      <MetaAnalyticsSection 
        clientId={clientId} 
        clientName={client?.name || ""} 
      />
    </AnalyticsPageLayout>
  );
};

export default MetaAnalyticsPage;
