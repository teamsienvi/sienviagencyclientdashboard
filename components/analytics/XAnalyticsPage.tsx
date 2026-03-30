"use client";

import XAnalyticsSection from "@/components/XAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsPageLayout } from "@/components/AnalyticsPageLayout";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function XAnalyticsPage({ clientId }: { clientId: string }) {
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
      pageName="X Analytics"
      pageDescription="X (Twitter) Analytics"
      isLoading={loading}
    >
      <XAnalyticsSection
        clientId={clientId}
        clientName={client?.name || ""}
      />
    </AnalyticsPageLayout>
  );
}
