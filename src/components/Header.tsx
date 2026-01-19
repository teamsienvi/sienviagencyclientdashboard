import { Activity, ChevronDown, Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import sienviLogo from "@/assets/sienvi-agency-client-logo.jpg";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
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
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch clients for admin dropdown
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && isAuthenticated,
  });

  // Get current client from URL if on a client page
  const getCurrentClientId = () => {
    const match = location.pathname.match(/\/client\/([^/]+)|\/(?:meta|youtube|x|tiktok|linkedin|web|ads)-(?:analytics|metricool)\/([^/]+)/);
    return match?.[1] || match?.[2] || null;
  };

  const currentClientId = getCurrentClientId();
  const currentClient = clients?.find(c => c.id === currentClientId);

  const handleClientSelect = (clientId: string) => {
    navigate(`/client/${clientId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleLogoClick = () => {
    if (isAdmin) {
      navigate("/");
    }
    // Non-admin users stay on their client page - logo click does nothing
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 animate-fade-in">
            <div 
              className={`relative group ${isAdmin ? 'cursor-pointer' : ''}`} 
              onClick={handleLogoClick}
            >
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img 
                src={sienviLogo} 
                alt="SIENVI Agency Logo" 
                className="relative h-16 w-16 object-contain rounded-xl shadow-sm"
              />
            </div>
            <div>
              <h1 
                className={`text-2xl font-heading font-bold text-foreground uppercase tracking-tight ${isAdmin ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                onClick={handleLogoClick}
              >
                SIENVI AGENCY
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-medium">Client Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Admin Client Selector - Only show for admins */}
            {isAdmin && clients && clients.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline max-w-[150px] truncate">
                      {currentClient?.name || "Switch Client"}
                    </span>
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
                      className={`cursor-pointer flex items-center gap-2 ${currentClientId === client.id ? 'bg-accent' : ''}`}
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
            <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Live Data</span>
            </Button>
            <ThemeToggle />
            {isAuthenticated && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="gap-2 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all duration-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
