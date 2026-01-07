import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { ArrowLeft } from "lucide-react";
import XAnalyticsSection from "@/components/XAnalyticsSection";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const XAnalytics = () => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-48 mb-8" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Client not found.</p>
          <Link to={`/client/${clientId}`} className="text-primary hover:underline">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Link
          to={`/client/${clientId}`}
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center gap-4 mb-8">
          {client.logo_url && (
            <img 
              src={client.logo_url} 
              alt={client.name} 
              className="h-12 w-12 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
            <p className="text-muted-foreground">X (Twitter) Analytics</p>
          </div>
        </div>

        <XAnalyticsSection 
          clientId={clientId || ""} 
          clientName={client.name} 
        />
      </main>
    </div>
  );
};

export default XAnalytics;
