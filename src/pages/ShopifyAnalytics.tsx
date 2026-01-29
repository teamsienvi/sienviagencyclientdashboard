import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import ShopifyAnalyticsSection from "@/components/ShopifyAnalyticsSection";
import { useAuth } from "@/hooks/useAuth";
import { useClientAccess } from "@/hooks/useClientAccess";
import { AccessDenied } from "@/components/AccessDenied";

const ShopifyAnalytics = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useClientAccess(clientId);

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
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

  // Loading state
  if (isLoadingClient || authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Access check - only admin or account_manager (admin role covers both for now)
  if (!hasAccess && !isAdmin) {
    return <AccessDenied />;
  }

  // Client not found
  if (!client) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Client not found</p>
              <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Back Navigation */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/client/${clientId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ShoppingBag className="h-8 w-8 text-green-600" />
                {client.name} - Shopify Analytics
              </h1>
              <p className="text-muted-foreground">
                E-commerce performance and insights
              </p>
            </div>
          </div>

          {/* Shopify Analytics Section */}
          <ShopifyAnalyticsSection
            clientId={clientId!}
            clientName={client.name}
          />
        </div>
      </main>
    </div>
  );
};

export default ShopifyAnalytics;
