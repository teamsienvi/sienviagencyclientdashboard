import RedditAnalyticsPage from "@/components/analytics/RedditAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reddit Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <RedditAnalyticsPage clientId={clientId} />;
}
