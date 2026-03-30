import YouTubeAnalyticsPage from "@/components/analytics/YouTubeAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "YouTube Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <YouTubeAnalyticsPage clientId={clientId} />;
}
