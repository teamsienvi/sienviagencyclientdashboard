import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Exchange LWA refresh token for an access token.
 */
async function getLWAAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    const response = await fetch("https://api.amazon.com/auth/o2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LWA token exchange failed: ${errText}`);
    }

    const data = await response.json();
    return data.access_token;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch all active credentials
        const { data: credentials, error: credError } = await supabase
            .from("amazon_spapi_credentials")
            .select("*");

        if (credError) {
            throw new Error("Failed to fetch Amazon credentials: " + credError.message);
        }

        let syncedCount = 0;
        const results = [];

        for (const cred of credentials) {
            try {
                console.log(`Syncing Amazon Orders for Client ID: ${cred.client_id}`);
                const accessToken = await getLWAAccessToken(cred.lwa_client_id, cred.lwa_client_secret, cred.refresh_token);

                // Note: Fetching Sales and Traffic report typically requires creating a report request,
                // waiting for it to complete, and downloading the document.
                // For this MVP, we scaffold the endpoint integration.
                const marketplaceId = "ATVPDKIKX0DER"; // US Marketplace
                const yesterday = new Date(Date.now() - 86400000).toISOString();
                const endpoint = `https://sellingpartnerapi-na.amazon.com/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${yesterday}`;
                
                console.log(`Fetching orders from SP-API for client ${cred.client_id}...`);
                const ordersRes = await fetch(endpoint, {
                    headers: {
                        "x-amz-access-token": accessToken,
                        "Content-Type": "application/json"
                    }
                });

                let totalOrders = 0;
                let dailyRevenue = 0;

                if (ordersRes.ok) {
                    const ordersData = await ordersRes.json();
                    const orders = ordersData.payload?.Orders || [];
                    totalOrders = orders.length;
                    
                    // Simple revenue estimation from OrderTotal if available
                    for (const order of orders) {
                        if (order.OrderTotal && order.OrderTotal.Amount) {
                            dailyRevenue += parseFloat(order.OrderTotal.Amount);
                        }
                    }
                } else {
                    console.error(`Failed to fetch from SP-API: ${await ordersRes.text()}`);
                }
                
                const today = new Date().toISOString().split('T')[0];

                const { error: upsertError } = await supabase
                    .from("amazon_sales_metrics")
                    .upsert({
                        client_id: cred.client_id,
                        date: today,
                        ordered_product_sales_amount: dailyRevenue,
                        ordered_product_sales_currency: "USD",
                        units_ordered: totalOrders, // Assuming 1 unit per order for now
                        total_order_items: totalOrders,
                        page_views: 0

                    }, { onConflict: 'client_id, date' });

                if (upsertError) {
                    console.error(`Failed to upsert metrics for client ${cred.client_id}:`, upsertError);
                    results.push({ client_id: cred.client_id, success: false, error: upsertError.message });
                } else {
                    syncedCount++;
                    results.push({ client_id: cred.client_id, success: true });
                }

            } catch (err) {
                console.error(`Error syncing for client ${cred.client_id}:`, err);
                results.push({ client_id: cred.client_id, success: false, error: err instanceof Error ? err.message : String(err) });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully synchronized Amazon Orders for ${syncedCount} clients.`,
                results
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Amazon Orders Sync Error:", error);
        return new Response(
            JSON.stringify({ 
                success: false, 
                message: error instanceof Error ? error.message : "Sync failed." 
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
