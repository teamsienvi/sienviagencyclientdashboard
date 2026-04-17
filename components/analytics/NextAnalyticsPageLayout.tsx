"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { ChevronRight, Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface AnalyticsPageLayoutProps {
  clientId: string;
  clientName?: string;
  clientLogo?: string | null;
  pageName: string;
  pageDescription?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const NextAnalyticsPageLayout = ({
  clientId,
  clientName,
  clientLogo,
  pageName,
  pageDescription,
  isLoading = false,
  children,
}: AnalyticsPageLayoutProps) => {
  const router = useRouter();
  const { isAdmin, isAuthenticated, user } = useAuth();

  // Fetch all clients unconditionally for the Switch Client dropdown
  const { data: clients } = useQuery({
    queryKey: ["all-clients-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  const showClientSwitcher = clients && clients.length > 0;

  const handleClientSelect = (newClientId: string) => {
    router.push(`/client/${newClientId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-6 w-64 mb-4" />
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!clientName) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Client not found.</p>
          <Link href="/" className="text-primary hover:underline">
            Back to Dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 py-10 max-w-7xl animate-fade-in">
        
        <div className="mb-8">
          <Link 
            href={`/client/${clientId}`} 
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
          >
            <ChevronRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
            Back to {clientName ? `${clientName} Overview` : 'Dashboard'}
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-10 pb-8 border-b border-border/40">
          {clientLogo ? (
            <div className="h-16 w-16 rounded-xl border border-border/60 shadow-sm bg-white flex-shrink-0 overflow-hidden">
              <img 
                src={clientLogo} 
                alt={clientName} 
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-xl border border-border/60 shadow-sm bg-muted flex items-center justify-center flex-shrink-0">
               <Building2 className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">{pageName}</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">{pageDescription || `Detailed analytics for ${clientName}`}</p>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
};
