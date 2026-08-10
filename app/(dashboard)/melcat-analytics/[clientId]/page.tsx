import MelCatAnalyticsPage from "@/components/analytics/MelCatAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MelCat Digital Products | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <MelCatAnalyticsPage clientId={clientId} />;
}
