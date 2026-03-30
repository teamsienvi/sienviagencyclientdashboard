import AdsAnalyticsPage from "@/components/analytics/AdsAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ads Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <AdsAnalyticsPage clientId={clientId} />;
}
