import ShopifyAnalyticsPage from "@/components/analytics/ShopifyAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shopify Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <ShopifyAnalyticsPage clientId={clientId} />;
}
