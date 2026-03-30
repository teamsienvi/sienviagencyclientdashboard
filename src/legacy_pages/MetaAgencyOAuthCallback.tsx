import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const MetaAgencyOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      setStatus("error");
      setErrorMessage(errorDescription || error);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code received");
      return;
    }

    try {
      const redirectUri = `${window.location.origin}/oauth/meta/agency/callback`;

      const { data, error: fnError } = await supabase.functions.invoke(
        "meta-agency-oauth-callback",
        {
          body: { code, redirectUri },
        }
      );

      if (fnError) throw fnError;

      if (data?.success) {
        setStatus("success");
        toast.success("Agency Meta account connected successfully!");
        
        // Automatically trigger discovery
        try {
          await supabase.functions.invoke("meta-discover");
          toast.success("Assets discovered successfully!");
        } catch (discoverError) {
          console.error("Discovery error:", discoverError);
          // Non-critical, don't fail the whole flow
        }
      } else {
        throw new Error(data?.error || "Connection failed");
      }
    } catch (err) {
      console.error("OAuth callback error:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "loading" && (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Connecting...
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Connected!
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-6 w-6 text-destructive" />
                Connection Failed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Setting up your agency Meta connection..."}
            {status === "success" && "Your agency Meta account has been connected and assets discovered."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status !== "loading" && (
            <Button onClick={() => navigate("/admin/meta-assets")}>
              {status === "success" ? "View Meta Assets" : "Try Again"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaAgencyOAuthCallback;
