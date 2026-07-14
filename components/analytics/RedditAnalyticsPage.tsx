"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NextAnalyticsPageLayout as AnalyticsPageLayout } from "@/components/analytics/NextAnalyticsPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.75-1.64-5.99-1.72l1.27-3.99 4.15.88c.05 1.05.92 1.88 1.99 1.88 1.1 0 2-1 2-2s-1-2-2-2c-1.02 0-1.87.77-1.98 1.77L13.1 3.52c-.23-.05-.47.09-.54.32l-1.46 4.6C8.84 8.5 6.7 9.14 5.06 10.15c-.56-.76-1.46-1.24-2.42-1.24-1.65 0-3 1.35-3 3 0 1.2.71 2.24 1.74 2.74-.08.3-.12.61-.12.92 0 3.72 4.19 6.75 9.35 6.75s9.35-3.03 9.35-6.75c0-.31-.04-.62-.12-.92 1.03-.5 1.74-1.54 1.74-2.74zm-18 2c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm10.74 3.73c-.76.76-2.2 1.27-3.74 1.27s-2.98-.51-3.74-1.27c-.19-.19-.19-.51 0-.7.19-.19.51-.19.7 0 .54.54 1.59.87 3.04.87s2.5-.33 3.04-.87c.19-.19.51-.19.7 0 .2.19.2.51.01.7zm-.74-1.73c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
  </svg>
);

export default function RedditAnalyticsPage({ clientId }: { clientId: string }) {
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
      pageName="Reddit Analytics"
      pageDescription="Reddit Profile & Analytics Redirect"
      isLoading={loading}
    >
      <Card className="border-orange-500/20 bg-orange-500/5 shadow-sm">
        <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 rounded-lg">
              <RedditIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">Reddit Profile Redirect</h4>
              <p className="text-sm text-muted-foreground">
                Reddit analytics are not currently integrated. Click the button to visit and manage Hwabelle's Reddit profile directly.
              </p>
            </div>
          </div>
          <Button asChild className="bg-orange-600 hover:bg-orange-700 text-white shrink-0">
            <a href="https://www.reddit.com/user/Hwabelle/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              Visit Reddit Profile
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </AnalyticsPageLayout>
  );
}
