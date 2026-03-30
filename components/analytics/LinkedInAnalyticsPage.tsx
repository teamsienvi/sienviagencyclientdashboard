"use client";

import { Linkedin } from "lucide-react";
import { MetricoolAnalyticsSection } from "@/components/MetricoolAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function LinkedInAnalyticsPage({ clientId }: { clientId: string }) {
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
      if (!error && data) setClient(data);
      setLoading(false);
    };
    fetchClient();
  }, [clientId]);

  return (
    <AnalyticsPageLayout
      clientId={clientId}
      clientName={client?.name}
      clientLogo={client?.logo_url}
      pageName="LinkedIn Analytics"
      pageDescription="LinkedIn Analytics (via Metricool)"
      isLoading={loading}
    >
      <MetricoolAnalyticsSection
        clientId={clientId}
        clientName={client?.name || ""}
        platform="linkedin"
        platformIcon={<Linkedin className="h-5 w-5" />}
        platformColor="text-[#0A66C2]"
      />
    </AnalyticsPageLayout>
  );
}
