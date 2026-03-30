import LinkedInAnalyticsPage from "@/components/analytics/LinkedInAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LinkedIn Analytics | Sienvi Agency",
};

export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <LinkedInAnalyticsPage clientId={clientId} />;
}
