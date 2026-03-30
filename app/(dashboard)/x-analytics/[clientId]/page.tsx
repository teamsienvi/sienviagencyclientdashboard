import XAnalyticsPage from "@/components/analytics/XAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "X Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <XAnalyticsPage clientId={clientId} />;
}
