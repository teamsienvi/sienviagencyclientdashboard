import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Bug, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function MetaOAuthDebug() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const META_APP_ID = "1221558249874924";
  const redirectUri = `${window.location.origin}/oauth/meta/callback`;
  
  const instagramScopes = [
    "instagram_basic",
    "instagram_manage_insights", 
    "business_management",
    "pages_show_list",
    "pages_read_engagement"
  ];
  
  const facebookScopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "read_insights",
    "instagram_basic",
    "instagram_manage_insights"
  ];

  const buildOAuthUrl = (platform: "instagram" | "facebook") => {
    const scopes = platform === "instagram" ? instagramScopes : facebookScopes;
    const state = JSON.stringify({ clientId: "test-client", platform });
    const encodedState = encodeURIComponent(btoa(state));
    
    const url = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    url.searchParams.set("client_id", META_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("state", encodedState);
    url.searchParams.set("response_type", "code");
    
    return url.toString();
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => copyToClipboard(text, field)}
      className="shrink-0"
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <Bug className="h-5 w-5" />
          Meta OAuth Debug Info
        </CardTitle>
        <CardDescription>
          Copy these values and verify they match your Meta App settings exactly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Origin */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Current Origin (App Domain)</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all">
              {window.location.origin.replace("https://", "")}
            </code>
            <CopyButton text={window.location.origin.replace("https://", "")} field="origin" />
          </div>
          <p className="text-xs text-muted-foreground">
            → Add to: App Settings → Basic → App Domains
          </p>
        </div>

        {/* Redirect URI */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Redirect URI</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm break-all">
              {redirectUri}
            </code>
            <CopyButton text={redirectUri} field="redirectUri" />
          </div>
          <p className="text-xs text-muted-foreground">
            → Add to: Facebook Login → Settings → Valid OAuth Redirect URIs
          </p>
        </div>

        {/* Meta App ID */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Meta App ID</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
              {META_APP_ID}
            </code>
            <CopyButton text={META_APP_ID} field="appId" />
          </div>
          <p className="text-xs text-muted-foreground">
            → Verify this matches your Meta App ID in the dashboard
          </p>
        </div>

        {/* Instagram Scopes */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Instagram Scopes</label>
          <div className="flex flex-wrap gap-1">
            {instagramScopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="font-mono text-xs">
                {scope}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            → Ensure all these permissions are "Ready to use" in App Review → Permissions
          </p>
        </div>

        {/* Facebook Scopes */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Facebook Scopes</label>
          <div className="flex flex-wrap gap-1">
            {facebookScopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="font-mono text-xs">
                {scope}
              </Badge>
            ))}
          </div>
        </div>

        {/* Full OAuth URLs */}
        <div className="space-y-4 pt-4 border-t">
          <label className="text-sm font-medium">Full OAuth URLs (for testing)</label>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Instagram OAuth URL</span>
              <div className="flex gap-2">
                <CopyButton text={buildOAuthUrl("instagram")} field="igUrl" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(buildOAuthUrl("instagram"), "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <code className="block rounded bg-muted px-3 py-2 text-xs break-all max-h-24 overflow-auto">
              {buildOAuthUrl("instagram")}
            </code>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Facebook OAuth URL</span>
              <div className="flex gap-2">
                <CopyButton text={buildOAuthUrl("facebook")} field="fbUrl" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(buildOAuthUrl("facebook"), "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <code className="block rounded bg-muted px-3 py-2 text-xs break-all max-h-24 overflow-auto">
              {buildOAuthUrl("facebook")}
            </code>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2 pt-4 border-t">
          <label className="text-sm font-medium">Quick Checklist</label>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>App is in <strong>Live</strong> mode (or Dev mode with you as tester)</li>
            <li><strong>Facebook Login</strong> product is added to the app</li>
            <li><strong>Instagram Graph API</strong> product is added (for IG scopes)</li>
            <li><strong>Client OAuth Login</strong> = ON in Facebook Login settings</li>
            <li><strong>Web OAuth Login</strong> = ON in Facebook Login settings</li>
            <li>Your IG account is <strong>Business/Creator</strong> linked to a <strong>Facebook Page</strong></li>
            <li>You have <strong>Admin access</strong> to that Facebook Page</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
