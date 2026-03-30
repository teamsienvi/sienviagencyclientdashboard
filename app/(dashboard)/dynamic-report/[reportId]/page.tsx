import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";
import { getReportClientId } from "@/server/queries/reports";
import DynamicReportShell from "@/components/dashboard/DynamicReportShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Weekly Report | Sienvi Agency",
};

export default async function DynamicReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const ctx = await requireAuth();

  // Verify the report exists and get its client_id
  const clientId = await getReportClientId(reportId);
  if (!clientId) {
    notFound();
  }

  // Access check: admins can view any report; clients can only view their own
  if (!ctx.isAdmin) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: assignment } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("user_id", ctx.userId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!assignment) {
      notFound(); // Don't reveal that the report exists
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DynamicReportShell reportId={reportId} />
    </div>
  );
}
