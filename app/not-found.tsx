import Link from "next/link";

export const metadata = {
  title: "Page Not Found | Sienvi Agency",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-6xl font-heading font-bold text-foreground mb-4">404</h1>
      <h2 className="text-xl text-muted-foreground mb-6">
        This page could not be found.
      </h2>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
