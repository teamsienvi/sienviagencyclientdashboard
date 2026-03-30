"use client";

import YouTubeAnalyticsSection from "@/components/YouTubeAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function YouTubeAnalyticsPage({ clientId }: { clientId: string }) {
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
      pageName="YouTube Analytics"
      pageDescription="YouTube Analytics"
      isLoading={loading}
    >
      <YouTubeAnalyticsSection
        clientId={clientId}
        clientName={client?.name || ""}
      />
    </AnalyticsPageLayout>
  );
}
