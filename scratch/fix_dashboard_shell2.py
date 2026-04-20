import re

with open('components/dashboard/ClientDashboardShell.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace breadcrumb with clean Back link
marker_breadcrumb = """                <Breadcrumb className="mb-1">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1 text-xs">
                          <BarChart3 className="h-3 w-3" />
                          Home
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator>
                      <ChevronRight className="h-3 w-3" />
                    </BreadcrumbSeparator>
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-xs">Dashboard</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>"""

replacement_breadcrumb = """                <div className="mb-4">
                  <Link 
                    href="/" 
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group px-2 py-1 -ml-2 rounded-md hover:bg-muted/50"
                  >
                    <ChevronRight className="h-3 w-3 rotate-180 transition-transform group-hover:-translate-x-1" />
                    Back to Command Center
                  </Link>
                </div>"""

content = content.replace(marker_breadcrumb, replacement_breadcrumb)

# Replace the ClientHeader function block with the new Header top-bar style
marker_header = """const ClientHeader = ({ clientName, clientLogo, currentClientId }: { clientName?: string; clientLogo?: string | null; currentClientId?: string }) => {
  const router = useRouter();
  const { isAdmin, isAuthenticated, signOut, user } = useAuth();

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

  const handleClientSelect = (clientId: string) => {
    router.push(`/client/${clientId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleBackClick = () => {
    if (isAdmin) {
      router.push("/");
    }
    // Non-admin users with single client - no back navigation
    // Non-admin users with multiple clients can use the switcher
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Only show back button for admins */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackClick}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            {clientLogo && (
              <div className="h-10 w-10 rounded-lg overflow-hidden border">
                <img
                  src={clientLogo}
                  alt={clientName || "Client"}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div>
              <h1 className="text-xl font-bold text-foreground">
                {clientName || "Client Dashboard"}
              </h1>
              <p className="text-sm text-muted-foreground">Analytics & Reports</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Client Selector - for admins OR users with multiple assigned clients */}
            {showClientSwitcher && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                    {clientLogo ? (
                      <img src={clientLogo} alt={clientName || "Client"} className="h-4 w-4 rounded-sm object-cover" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline max-w-[150px] truncate">
                      {clientName || "Switch Client"}
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
                      {getClientLogo(client.name, client.logo_url) ? (
                        <img
                          src={getClientLogo(client.name, client.logo_url)!}
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
            <ThemeToggle />
            {/* Logout button for all authenticated users */}
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
}"""

replacement_header = """const ClientHeader = ({ clientName, clientLogo, currentClientId }: { clientName?: string; clientLogo?: string | null; currentClientId?: string }) => {
  const router = useRouter();
  const { isAdmin, isAuthenticated, signOut } = useAuth();

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
  const currentClient = clients?.find(c => c.id === currentClientId);

  const handleClientSelect = (clientId: string) => {
    router.push(`/client/${clientId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleBackClick = () => {
    if (isAdmin) {
      router.push("/");
    }
  };

  return (
    <header className="border-b border-border/40 bg-card sticky top-0 z-50 transition-colors duration-300 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 animate-fade-in">
          <div 
            className={`flex items-center gap-3 ${isAdmin ? 'cursor-pointer group' : ''}`} 
            onClick={handleBackClick}
          >
            {clientLogo ? (
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/60 shadow-sm flex-shrink-0 bg-white">
                <img 
                  src={clientLogo} 
                  alt={clientName || "Client"} 
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg border border-border/60 shadow-sm bg-muted flex items-center justify-center">
                 <Building2 className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
              </div>
            )}
            <div className="hidden sm:flex flex-col">
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none group-hover:text-primary transition-colors">
                {clientName || "Client Dashboard"}
              </h1>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">Analytics Portal</span>
            </div>
          </div>

          {showClientSwitcher && (
            <div className="h-6 w-px bg-border/60 hidden sm:block mx-2" />
          )}

          {showClientSwitcher && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2.5 h-8 px-2 text-muted-foreground hover:text-foreground font-medium hover:bg-muted/50 rounded-md transition-all">
                  {currentClient?.logo_url ? (
                    <img src={currentClient.logo_url} alt={currentClient.name} className="h-4 w-4 rounded-sm object-cover ring-1 ring-border shadow-sm" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  <span className="max-w-[150px] truncate">
                    {currentClient?.name || "Switch Client"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[240px] max-h-[400px] overflow-y-auto mt-1 rounded-xl shadow-lg border-border/40 p-1">
                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground px-3 py-2 font-semibold">Active Clients</DropdownMenuLabel>
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
          )}
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
}"""

content = content.replace(marker_header, replacement_header)

with open('components/dashboard/ClientDashboardShell.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
