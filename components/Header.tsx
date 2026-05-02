"use client";

import { Activity, ChevronDown, ChevronRight, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import sienviLogo from "@/assets/sienvi-agency-client-logo.jpg";
import { useAuth } from "@/hooks/useAuth";
import { useUserClients } from "@/hooks/useClientAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Header = () => {
  const { isAdmin, isAuthenticated, signOut, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Fetch only the clients the user has access to
  const { data: clients } = useUserClients();

  const showClientSwitcher = clients && clients.length > 0;

  // Get current client from URL if on a client page
  const getCurrentClientId = () => {
    const match = pathname?.match(/\/client\/([^/]+)|\/(?:meta|youtube|x|tiktok|linkedin|web|ads)-(?:analytics|metricool)\/([^/]+)/);
    return match?.[1] || match?.[2] || null;
  };

  const currentClientId = getCurrentClientId();
  const currentClient = clients?.find(c => c.id === currentClientId);

  const handleClientSelect = (clientId: string) => {
    router.push(`/client/${clientId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleDashboardClick = () => {
    if (isAdmin) {
      router.push("/");
    }
  };

  return (
    <header className="border-b border-border/40 bg-card sticky top-0 z-50 transition-colors duration-300 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 animate-fade-in">
          {/* Logo - completely static and non-interactive for pure branding */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-border shadow-sm flex-shrink-0 bg-white">
              <img 
                src={sienviLogo.src} 
                alt="SIENVI Agency" 
                className="h-full w-full object-cover"
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">
                SIENVI AGENCY
              </h1>
            </div>
          </div>

          <div className="h-6 w-px bg-border/60 hidden sm:block mx-1" />

          <div className="flex items-center gap-2">
            {/* Primary App Shell Nav - Command Center / Home */}
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDashboardClick}
                className={`gap-2 h-8 px-3 font-medium transition-all ${pathname === "/" ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Command Center</span>
              </Button>
            )}

            {/* Client Selector (Only shows if there are multiple clients) */}
            {showClientSwitcher && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className={`gap-2.5 h-8 px-3 transition-all ${pathname !== "/" ? "bg-primary/5 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"}`}>
                      {currentClient?.logo_url ? (
                        <img src={currentClient.logo_url} alt={currentClient.name} className="h-4 w-4 rounded-sm object-cover ring-1 ring-border shadow-sm" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <span className="max-w-[150px] truncate">
                        {currentClient?.name || "Select Client Portfolio"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[240px] max-h-[400px] overflow-y-auto mt-1 rounded-xl shadow-lg border-border/40 p-1">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-2 font-semibold">Active Portfolios</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {clients.map((client) => (
                      <DropdownMenuItem
                        key={client.id}
                        onClick={() => handleClientSelect(client.id)}
                        className={`cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${currentClientId === client.id ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted focus:bg-muted'}`}
                      >
                        {client.logo_url ? (
                          <img 
                            src={client.logo_url} 
                            alt={client.name} 
                            className="h-6 w-6 rounded-md object-cover ring-1 ring-border shadow-sm"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center ring-1 ring-border">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate">{client.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isAuthenticated && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut}
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
