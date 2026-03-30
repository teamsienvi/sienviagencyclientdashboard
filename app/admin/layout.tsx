export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/guards";

/**
 * Admin layout — server component.
 * Calls requireAdmin() BEFORE rendering any admin UI.
 * Non-admin users are rejected server-side (redirect to /).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
