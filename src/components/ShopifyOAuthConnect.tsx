import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShopifyOAuthConnectProps {
  clientId: string;
  clientName: string;
  onConnected?: () => void;
}

const STORE_DOMAINS: Record<string, string> = {
  "Snarky Pets": "fhfwar-jc.myshopify.com",
  "Snarky Humans": "bedd78-a1.myshopify.com",
  "BlingyBag": "3bc448-da.myshopify.com",
  "OxiSure Tech": "oxisure-tech.myshopify.com",
};

export const ShopifyOAuthConnect = ({ clientId, clientName, onConnected }: ShopifyOAuthConnectProps) => {
  const [connecting, setConnecting] = useState(false);
  const [shopDomain, setShopDomain] = useState(STORE_DOMAINS[clientName] || "");

  const redirectUri = useMemo(() => {
    // Shopify requires an exact, whitelisted redirect URI.
    return `${window.location.origin}/shopify/callback`;
  }, []);

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      toast.success("Redirect URI copied");
    } catch {
      toast.error("Could not copy redirect URI");
    }
  };

  const handleConnect = async () => {
    if (!shopDomain) {
      toast.error("Please enter your Shopify store domain");
      return;
    }

    setConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("shopify-oauth-init", {
        body: {
          clientId,
          shopDomain: shopDomain.trim(),
          redirectUri,
        },
      });

      if (error) throw error;

      if (data?.authUrl) {
        // Redirect to Shopify OAuth
        window.location.href = data.authUrl;
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Error initiating Shopify OAuth:", err);
      toast.error(err instanceof Error ? err.message : "Failed to connect to Shopify");
      setConnecting(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto p-4 rounded-full bg-green-500/10 mb-4 w-fit">
          <ShoppingBag className="h-12 w-12 text-green-600" />
        </div>
        <CardTitle>Connect Shopify Store</CardTitle>
        <CardDescription>
          Connect your Shopify store to view sales, orders, customer insights, and top-performing products.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="shopDomain">Store Domain</Label>
          <Input
            id="shopDomain"
            placeholder="your-store.myshopify.com"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            disabled={connecting}
          />
          <p className="text-xs text-muted-foreground">
            Enter your Shopify store domain (e.g., your-store.myshopify.com)
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Redirect URI (must be whitelisted)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyRedirectUri}
              disabled={connecting}
            >
              Copy
            </Button>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            <code className="text-xs break-all text-muted-foreground">{redirectUri}</code>
          </div>
          <p className="text-xs text-muted-foreground">
            Add this exact URL (no trailing slash) to your Shopify app’s Allowed redirection URL(s).
          </p>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleConnect}
          disabled={connecting || !shopDomain}
        >
          {connecting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="h-5 w-5 mr-2" />
              Connect to Shopify
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          You'll be redirected to Shopify to authorize access to your store's analytics data.
        </p>
      </CardContent>
    </Card>
  );
};

export default ShopifyOAuthConnect;
