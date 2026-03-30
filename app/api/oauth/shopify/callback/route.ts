import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Shopify OAuth callback Route Handler.
 * Handles both direct Shopify redirects (code/shop/state) and
 * success/error redirects from the edge function.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const resultBase = `${origin}/oauth/result`;

  // Case 1: Already resolved by edge function (success=true&clientId=...)
  const success = searchParams.get("success");
  const clientIdParam = searchParams.get("clientId");
  const errorParam = searchParams.get("error");

  if (success === "true" && clientIdParam) {
    const params = new URLSearchParams({
      provider: "shopify",
      status: "success",
      clientId: clientIdParam,
    });
    return NextResponse.redirect(`${resultBase}?${params}`);
  }

  if (errorParam) {
    const params = new URLSearchParams({
      provider: "shopify",
      status: "error",
      message: errorParam,
    });
    return NextResponse.redirect(`${resultBase}?${params}`);
  }

  // Case 2: Direct Shopify redirect with code/shop/state
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");

  if (!code || !shop || !state) {
    const params = new URLSearchParams({
      provider: "shopify",
      status: "error",
      message: "Invalid callback parameters",
    });
    return NextResponse.redirect(`${resultBase}?${params}`);
  }

  try {
    const supabase = await createClient();

    const { data, error: fnError } = await supabase.functions.invoke(
      "shopify-oauth-callback",
      { body: { code, shop, state } }
    );

    if (fnError) throw fnError;
    if (!data?.success) throw new Error(data?.error || "OAuth callback not handled properly");

    const params = new URLSearchParams({
      provider: "shopify",
      status: "success",
      ...(data?.clientId ? { clientId: data.clientId } : {}),
    });
    return NextResponse.redirect(`${resultBase}?${params}`);
  } catch (err) {
    const params = new URLSearchParams({
      provider: "shopify",
      status: "error",
      message: err instanceof Error ? err.message : "Failed to connect Shopify",
    });
    return NextResponse.redirect(`${resultBase}?${params}`);
  }
}
