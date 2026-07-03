import PinterestAnalyticsPage from "@/components/analytics/PinterestAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pinterest Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <PinterestAnalyticsPage clientId={clientId} />;
}
