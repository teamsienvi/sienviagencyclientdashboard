import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { getActiveClients, getActiveMetricoolConfigs, getUserClientAssignment } from "@/server/queries";
import DashboardClientShell from "@/components/dashboard/DashboardClientShell";

export const metadata = {
  title: "Agency Dashboard | Sienvi",
};

export default async function DashboardIndex() {
  const ctx = await requireAuth();

  // Non-admin: redirect to their assigned client dashboard
  if (!ctx.isAdmin) {
    const assignment = await getUserClientAssignment(ctx.userId);
    if (assignment?.client_id) {
      redirect(`/client/${assignment.client_id}`);
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <p className="text-muted-foreground text-lg">
          Your account has not been assigned to a client yet. Please contact your agency administrator.
        </p>
      </div>
    );
  }

  // Admin: fetch data and render the interactive dashboard shell
  const [dbClients, metricoolConfigs] = await Promise.all([
    getActiveClients(),
    getActiveMetricoolConfigs(),
  ]);

  return (
    <DashboardClientShell
      dbClients={dbClients}
      metricoolConfigs={metricoolConfigs}
    />
  );
}
