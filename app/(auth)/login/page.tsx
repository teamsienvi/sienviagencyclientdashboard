import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/guards";
import LoginForm from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In | Sienvi Agency",
};

export default async function LoginPage() {
  // Server-side: redirect authenticated users away from login
  const ctx = await getCurrentUserContext();
  if (ctx) {
    redirect("/");
  }

  return <LoginForm />;
}
