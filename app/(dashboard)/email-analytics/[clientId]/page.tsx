import { requireClientAccess } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getEmailCampaignMetrics } from "@/server/queries/email";
import EmailAnalyticsClient from "@/components/analytics/EmailAnalyticsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email Campaign Analytics | Sienvi Agency",
};

export default async function EmailAnalyticsRoute({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  
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

  // Fetch metrics dynamically from Sienvi Sender Next.js API (fully decoupled)
  const initialData = await getEmailCampaignMetrics(client.name);

  return (
    <EmailAnalyticsClient 
      clientId={clientId} 
      clientName={client.name} 
      clientLogo={client.logo_url}
      initialData={initialData} 
    />
  );
}
