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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/client/${clientId}`} className="hover:text-primary transition-colors">
                    Dashboard
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Client Switcher */}
          {showClientSwitcher && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Switch Client</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px] max-h-[400px] overflow-y-auto">
                <DropdownMenuLabel>Switch Client</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {clients.map((client) => (
                  <DropdownMenuItem
                    key={client.id}
                    onClick={() => handleClientSelect(client.id)}
                    className={`cursor-pointer flex items-center gap-2 ${clientId === client.id ? 'bg-accent' : ''}`}
                  >
                    {client.logo_url ? (
                      <img 
                        src={client.logo_url} 
                        alt={client.name} 
                        className="h-6 w-6 rounded object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="truncate">{client.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          {clientLogo && (
            <img 
              src={clientLogo} 
              alt={clientName} 
              className="h-12 w-12 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{clientName}</h1>
            <p className="text-muted-foreground">{pageDescription || pageName}</p>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
};
