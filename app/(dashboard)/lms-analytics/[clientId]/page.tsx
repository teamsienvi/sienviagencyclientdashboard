import { requireAuth } from "@/lib/auth/guards";
import LmsAnalyticsClient from "@/components/analytics/LmsAnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LMS Analytics | Sienvi Agency",
};

export default async function LmsAnalyticsRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAuth();
  const { clientId } = await params;
  return <LmsAnalyticsClient clientId={clientId} />;
}
