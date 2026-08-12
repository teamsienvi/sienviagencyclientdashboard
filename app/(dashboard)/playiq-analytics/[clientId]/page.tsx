import { requireClientAccess } from "@/lib/auth/guards";
import PlayIQAnalyticsClient from "@/components/analytics/PlayIQAnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Beta Testers Analytics | Sienvi Agency",
};

export default async function PlayIQAnalyticsRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  
  // Enforces auth + client access boundary
  await requireClientAccess(clientId);

  return <PlayIQAnalyticsClient clientId={clientId} />;
}
