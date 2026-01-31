import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ShoppingBag } from "lucide-react";

const ShopifyOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const success = searchParams.get("success");
  const clientId = searchParams.get("clientId");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success === "true" && clientId) {
      setStatus("success");
    } else if (error) {
      setStatus("error");
      setErrorMessage(error);
    } else {
      // Check if this is a direct callback from Shopify (will have code and shop params)
      const code = searchParams.get("code");
      const shop = searchParams.get("shop");
      
      if (code && shop) {
        // This means the edge function redirect failed - show error
        setStatus("error");
        setErrorMessage("OAuth callback not handled properly. Please try again.");
      } else {
        setStatus("error");
        setErrorMessage("Invalid callback parameters");
      }
    }
  }, [success, clientId, error, searchParams]);

  const handleContinue = () => {
    if (clientId) {
      navigate(`/shopify/${clientId}`);
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
