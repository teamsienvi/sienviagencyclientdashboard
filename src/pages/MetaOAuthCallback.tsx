import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        console.error("OAuth error:", error, errorDescription);
        setStatus("error");
        setErrorMessage(errorDescription || "Authorization was denied");
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Missing authorization code or state");
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/oauth/meta/callback`;

        const { data, error: callbackError } = await supabase.functions.invoke(
          "meta-oauth-callback",
          {
            body: { code, state, redirectUri },
          }
        );

        if (callbackError) throw callbackError;

        if (data.success) {
          setStatus("success");
          toast.success(`${data.account.platform} account connected successfully!`);
        } else {
          throw new Error(data.error || "Failed to connect account");
        }
      } catch (err) {
        console.error("Callback error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to complete authorization");
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {status === "loading" && "Connecting Account..."}
            {status === "success" && "Account Connected!"}
            {status === "error" && "Connection Failed"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we complete the authorization"}
            {status === "success" && "Your Meta account has been connected successfully"}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          {status === "error" && (
            <XCircle className="h-12 w-12 text-destructive" />
          )}

          <Button
            onClick={() => navigate("/admin")}
            variant={status === "error" ? "outline" : "default"}
          >
            {status === "error" ? "Try Again" : "Go to Admin"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
