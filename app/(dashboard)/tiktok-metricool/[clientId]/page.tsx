import TikTokAnalyticsPage from "@/components/analytics/TikTokAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "TikTok Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <TikTokAnalyticsPage clientId={clientId} />;
}
