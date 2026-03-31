import { requireAuth } from "@/lib/auth/guards";
import WebAnalyticsClient from "@/components/analytics/WebAnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Web Analytics | Sienvi Agency",
};

export default async function WebAnalyticsRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAuth();
  const { clientId } = await params;
  return <WebAnalyticsClient clientId={clientId} />;
}
