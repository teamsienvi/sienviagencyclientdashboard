import { requireClientAccess } from "@/lib/auth/guards";
import ClientDashboardShell from "@/components/dashboard/ClientDashboardShell";

export const metadata = {
  title: "Client Dashboard | Sienvi",
};

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  // Enforces auth + client access boundary (admin or assigned user)
  await requireClientAccess(clientId);

  return <ClientDashboardShell clientId={clientId} />;
}
