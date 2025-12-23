import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LinkedInOAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        console.error("LinkedIn OAuth error:", error, errorDescription);
        setStatus("error");
        setErrorMessage(errorDescription || error || "Authentication was denied");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Missing authorization code or state");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/oauth/linkedin/callback`;

        const { data, error: fnError } = await supabase.functions.invoke("linkedin-oauth-callback", {
          body: { code, state, redirectUri },
        });

        if (fnError) {
          throw fnError;
        }

        if (!data.success) {
          throw new Error(data.error || "Failed to connect LinkedIn account");
        }

        setStatus("success");
        toast.success("LinkedIn account connected successfully!");

        // Redirect after a short delay
        setTimeout(() => {
          navigate("/linkedin-analytics");
        }, 2000);
      } catch (err) {
        console.error("LinkedIn callback error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to complete authentication");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "processing" && <Loader2 className="h-6 w-6 animate-spin" />}
            {status === "success" && <CheckCircle className="h-6 w-6 text-green-500" />}
            {status === "error" && <XCircle className="h-6 w-6 text-red-500" />}
            LinkedIn Connection
          </CardTitle>
          <CardDescription>
            {status === "processing" && "Completing authentication..."}
            {status === "success" && "Successfully connected!"}
            {status === "error" && "Connection failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "processing" && (
            <p className="text-muted-foreground">
              Please wait while we connect your LinkedIn account...
            </p>
          )}

          {status === "success" && (
            <p className="text-muted-foreground">
              Your LinkedIn account has been connected. Redirecting to analytics...
            </p>
          )}

          {status === "error" && (
            <>
              <p className="text-red-600">{errorMessage}</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Go Home
                </Button>
                <Button onClick={() => navigate("/linkedin-analytics")}>
                  Try Again
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkedInOAuthCallback;
