export const dynamic = "force-dynamic";

import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset Password | Sienvi Agency",
};

export default function ResetPasswordPage() {
  // No server-side auth check here — the recovery link brings the user
  // with a valid session token. The client component validates the
  // PASSWORD_RECOVERY event from Supabase before showing the form.
  return <ResetPasswordForm />;
}
