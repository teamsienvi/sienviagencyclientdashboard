import { requireAuth } from "@/lib/auth/guards";
import MetaAnalyticsPage from "@/components/analytics/MetaAnalyticsPage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meta Analytics | Sienvi Agency",
};

export default async function MetaAnalyticsRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAuth();
  const { clientId } = await params;
  return <MetaAnalyticsPage clientId={clientId} />;
}
