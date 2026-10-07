import { requireClientAccess } from "@/lib/auth/guards";
import ClientDashboardShell from "@/components/dashboard/ClientDashboardShell";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Client Dashboard | Sienvi",
};

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  let resolvedClientId = clientId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);

  if (!isUUID) {
    const supabase = await createClient();
    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .ilike("name", clientId.replace(/-/g, " "))
      .maybeSingle();

    if (client?.id) {
      resolvedClientId = client.id;
    } else {
      const { data: allClients } = await supabase.from("clients").select("id, name");
      const normalizedInput = clientId.toLowerCase().replace(/[^a-z0-9]/g, "");
      const found = allClients?.find(
        (c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedInput
      );
      if (found?.id) {
        resolvedClientId = found.id;
      }
    }
  }

  // Enforces auth + client access boundary (admin or assigned user)
  await requireClientAccess(resolvedClientId);

  return <ClientDashboardShell clientId={resolvedClientId} />;
}

