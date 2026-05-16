import AmazonOrdersAnalyticsPage from "@/components/analytics/AmazonOrdersAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Amazon Orders Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <AmazonOrdersAnalyticsPage clientId={clientId} />;
}
