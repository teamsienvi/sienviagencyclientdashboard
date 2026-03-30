import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ShopifyOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resolvedClientId, setResolvedClientId] = useState<string>("");

  const success = searchParams.get("success");
  const clientId = searchParams.get("clientId");
  const error = searchParams.get("error");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (success === "true" && clientId) {
        if (cancelled) return;
        setResolvedClientId(clientId);
        setStatus("success");
        return;
      }

      if (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(error);
        return;
      }

      // Direct callback from Shopify (code/shop/state). We'll hand off to backend.
      const code = searchParams.get("code");
      const shop = searchParams.get("shop");
      const state = searchParams.get("state");

      if (code && shop && state) {
        if (cancelled) return;
        setStatus("loading");
        setErrorMessage("");

        try {
          const { data, error: fnError } = await supabase.functions.invoke("shopify-oauth-callback", {
            body: { code, shop, state },
          });

          if (fnError) throw fnError;

          const nextClientId = data?.clientId ?? "";
          if (!cancelled && nextClientId) setResolvedClientId(nextClientId);

          if (data?.success) {
            if (cancelled) return;
            setStatus("success");
            return;
          }

          throw new Error(data?.error || "OAuth callback not handled properly. Please try again.");
        } catch (err) {
          if (cancelled) return;
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "OAuth callback not handled properly. Please try again.");
          return;
        }
      }

      if (cancelled) return;
      setStatus("error");
      setErrorMessage("Invalid callback parameters");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [success, clientId, error, searchParams]);

  const handleContinue = () => {
    const id = resolvedClientId || clientId;
    if (id) {
      navigate(`/shopify/${id}`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {status === "loading" && (
              <>
                <div className="p-4 rounded-full bg-muted">
                  <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Connecting to Shopify...</h2>
                  <p className="text-muted-foreground">Please wait while we complete the connection.</p>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <div className="p-4 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Shopify Connected!</h2>
                  <p className="text-muted-foreground">
                    Your Shopify store has been successfully connected. You can now view your analytics.
                  </p>
                </div>
                <Button size="lg" className="mt-4" onClick={handleContinue}>
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  View Analytics
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <div className="p-4 rounded-full bg-red-500/10">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Connection Failed</h2>
                  <p className="text-muted-foreground">
                    {errorMessage || "Something went wrong while connecting to Shopify."}
                  </p>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => navigate("/")}>
                    Back to Dashboard
                  </Button>
                  <Button onClick={() => window.history.back()}>
                    Try Again
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyOAuthCallback;
