import { requireAdmin } from "@/lib/auth/guards";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Dashboard | Sienvi Agency",
};

export default async function AdminPage() {
  const ctx = await requireAdmin();
  return <AdminShell userEmail={ctx.email} />;
}
