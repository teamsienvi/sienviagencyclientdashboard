import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getEmailCampaignMetrics } from "@/server/queries/email";
import { getLeadPerformanceReport } from "@/server/queries/leadPerformance";
import EmailAnalyticsClient from "@/components/analytics/EmailAnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Campaign Analytics | Sienvi Agency",
};

export default async function EmailAnalyticsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<{ view?: string; recency?: string }>;
}) {
  const { clientId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  
  // Security boundary guard: limits access to administrators or mapped client users
  await requireClientAccess(clientId);

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, logo_url")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground text-lg">
          Client not found. Please verify client registrations in the Command Center.
        </p>
      </div>
    );
  }

  const isColdClient = ["playiq", "oxisure"].some((k) => client.name.toLowerCase().includes(k));
  const defaultView = isColdClient ? "lead-performance" : "overview";
  const currentView = resolvedSearchParams.view || defaultView;
  const currentRecency = resolvedSearchParams.recency || "all";

  // Fetch metrics dynamically in parallel
  const [initialData, leadPerformanceData] = await Promise.all([
    getEmailCampaignMetrics(client.name),
    getLeadPerformanceReport(client.name, currentRecency),
  ]);

  return (
    <EmailAnalyticsClient 
      clientId={clientId} 
      clientName={client.name} 
      clientLogo={client.logo_url}
      initialData={initialData} 
      initialLeadPerformanceData={leadPerformanceData}
      initialView={currentView}
      initialRecency={currentRecency}
    />
  );
}
