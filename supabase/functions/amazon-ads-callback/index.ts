import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        if (error) {
            return new Response(
                `<html><body><h1>Authorization Error</h1><p>${error}: ${errorDescription || "Unknown error"}</p></body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        if (!code) {
            return new Response(
                `<html><body><h1>Missing Code</h1><p>No authorization code received.</p></body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        const AMAZON_CLIENT_ID = Deno.env.get("AMAZON_ADS_CLIENT_ID");
        const AMAZON_CLIENT_SECRET = Deno.env.get("AMAZON_ADS_CLIENT_SECRET");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

        if (!AMAZON_CLIENT_ID || !AMAZON_CLIENT_SECRET) {
            return new Response(
                `<html><body><h1>Config Error</h1><p>Amazon Ads credentials not configured in Supabase secrets.</p></body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        const redirectUri = `${supabaseUrl}/functions/v1/amazon-ads-callback`;

        // Exchange code for tokens
        const tokenResponse = await fetch("https://api.amazon.com/auth/o2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                client_id: AMAZON_CLIENT_ID,
                client_secret: AMAZON_CLIENT_SECRET,
            }).toString(),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.refresh_token) {
            console.error("Token exchange failed:", tokenData);
            return new Response(
                `<html><body>
          <h1>Token Exchange Failed</h1>
          <pre>${JSON.stringify(tokenData, null, 2)}</pre>
        </body></html>`,
                { headers: { "Content-Type": "text/html" } }
            );
        }

        const { access_token, refresh_token, token_type, expires_in } = tokenData;

        // Fetch advertising profiles to get Profile ID
        const profilesResponse = await fetch("https://advertising-api.amazon.com/v2/profiles", {
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "Amazon-Advertising-API-ClientId": AMAZON_CLIENT_ID,
                "Content-Type": "application/json",
            },
        });

        let profilesData = [];
        let profilesError = null;
        if (profilesResponse.ok) {
            profilesData = await profilesResponse.json();
        } else {
            profilesError = await profilesResponse.text();
            console.error("Profiles fetch failed:", profilesError);
        }

        // Build a result page showing the tokens and profiles
        const profilesList = profilesData.map((p: any) =>
            `<tr>
        <td><strong>${p.profileId}</strong></td>
        <td>${p.countryCode || "N/A"}</td>
        <td>${p.accountInfo?.name || "N/A"}</td>
        <td>${p.accountInfo?.type || "N/A"}</td>
        <td>${p.accountInfo?.marketplaceStringId || "N/A"}</td>
      </tr>`
        ).join("");

        return new Response(
            `<html>
      <head><style>
        body { font-family: -apple-system, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f8f9fa; }
        .card { background: white; border-radius: 8px; padding: 24px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h1 { color: #1a7f37; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
        .secret { background: #fff3cd; padding: 12px; border-radius: 4px; border: 1px solid #ffc107; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f0f0; }
      </style></head>
      <body>
        <h1>✅ Amazon Ads Authorization Successful!</h1>
        
        <div class="card">
          <h2>🔑 Refresh Token</h2>
          <div class="secret">
            <p><strong>Save this — you'll need it to set up the Supabase secret:</strong></p>
            <code>${refresh_token}</code>
          </div>
        </div>

        <div class="card">
          <h2>📊 Advertising Profiles</h2>
          ${profilesData.length > 0 ? `
            <p>Select the Profile ID for the marketplace you want to track:</p>
            <table>
              <tr><th>Profile ID</th><th>Country</th><th>Account Name</th><th>Type</th><th>Marketplace</th></tr>
              ${profilesList}
            </table>
          ` : `
            <p style="color: red;">Could not fetch profiles: ${profilesError || "No profiles found"}</p>
            <p>You can fetch profiles later using the refresh token above.</p>
          `}
        </div>

        <div class="card">
          <h2>📋 Next Steps</h2>
          <p>Send these values back to me so I can configure the edge function:</p>
          <ol>
            <li><strong>Refresh Token:</strong> (shown above)</li>
            <li><strong>Profile ID:</strong> (from the table above)</li>
          </ol>
        </div>
      </body>
      </html>`,
            { headers: { "Content-Type": "text/html" } }
        );

    } catch (error) {
        console.error("Amazon Ads callback error:", error);
        return new Response(
            `<html><body>
        <h1>Error</h1>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
      </body></html>`,
            { headers: { "Content-Type": "text/html" } }
        );
    }
});
