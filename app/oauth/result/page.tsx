"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

function OAuthResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const provider = searchParams.get("provider") ?? "Unknown";
  const status = searchParams.get("status") ?? "error";
  const message = searchParams.get("message");
  const clientId = searchParams.get("clientId");

  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  const isSuccess = status === "success";

  const handleNavigate = () => {
    if (clientId) {
      router.push(`/client/${clientId}`);
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isSuccess ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <CardTitle>
            {isSuccess
              ? `${providerLabel} Connected!`
              : `${providerLabel} Connection Failed`}
          </CardTitle>
          <CardDescription>
            {isSuccess
              ? `Your ${providerLabel} account has been connected successfully.`
              : message || "An error occurred during authorization."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={handleNavigate}>
            {isSuccess ? "Go to Dashboard" : "Back to Dashboard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <OAuthResultContent />
    </Suspense>
  );
}
