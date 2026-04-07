import { requireAuth } from "@/lib/auth/guards";
import SubstackAnalyticsClient from "@/components/analytics/SubstackAnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Substack Analytics | Sienvi Agency",
};

export default async function SubstackAnalyticsRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAuth();
  const { clientId } = await params;
  return <SubstackAnalyticsClient clientId={clientId} />;
}
