"use client";

import { MetricoolAnalyticsSection } from "@/components/MetricoolAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const PinterestIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.41 7.61 11.175-.105-.945-.199-2.4.041-3.431.222-.947 1.452-6.14 1.452-6.14s-.369-.742-.369-1.84c0-1.724 1-3.012 2.244-3.012 1.055 0 1.568.79 1.568 1.74 0 1.06-.675 2.647-1.021 4.12-.29 1.23.61 2.232 1.829 2.232 2.197 0 3.886-2.317 3.886-5.659 0-2.959-2.128-5.03-5.17-5.03-3.52 0-5.587 2.64-5.587 5.37 0 1.06.409 2.203.92 2.82.1.12.118.23.087.35-.096.39-.309 1.258-.35 1.42-.055.22-.18.27-.417.16-1.558-.72-2.53-2.99-2.53-4.81 0-3.92 2.85-7.52 8.21-7.52 4.3 0 7.66 3.07 7.66 7.18 0 4.28-2.7 7.72-6.45 7.72-1.26 0-2.45-.66-2.85-1.44l-.777 2.96c-.282 1.08-1.049 2.43-1.56 3.27 1.13.33 2.33.51 3.57.51 6.62 0 11.987-5.366 11.987-11.987C23.999 5.368 18.63 0 12.017 0z"/>
  </svg>
);

export default function PinterestAnalyticsPage({ clientId }: { clientId: string }) {
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
      pageName="Pinterest Analytics"
      pageDescription="Pinterest Analytics (via Metricool)"
      isLoading={loading}
    >
      <MetricoolAnalyticsSection
        clientId={clientId}
        clientName={client?.name || ""}
        platform="pinterest"
        platformIcon={<PinterestIcon className="h-5 w-5" />}
        platformColor="text-red-600"
      />
    </AnalyticsPageLayout>
  );
}
