import re

with open('components/dashboard/ClientDashboardShell.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the ClientHeader function block to add explicit Home button
marker_header = """  return (
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
                <Button variant="ghost" size="sm" className="gap-2.5 h-8 px-2 text-muted-foreground hover:text-foreground font-medium hover:bg-muted/50 rounded-md transition-all">"""

replacement_header = """  return (
    <header className="border-b border-border/40 bg-card sticky top-0 z-50 transition-colors duration-300 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 animate-fade-in">
          {/* Static Branding */}
          <div className="flex items-center gap-3">
            {clientLogo ? (
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-border/60 shadow-sm flex-shrink-0 bg-white">
                <img 
                  src={clientLogo} 
                  alt={clientName || "Client"} 
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-lg border border-border/60 shadow-sm bg-muted flex items-center justify-center">
                 <Building2 className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
              </div>
            )}
            <div className="hidden sm:flex flex-col">
              <h1 className="text-sm font-semibold tracking-tight text-foreground leading-none">
                {clientName || "Client Dashboard"}
              </h1>
            </div>
          </div>

          <div className="h-6 w-px bg-border/60 hidden sm:block mx-1" />

          <div className="flex items-center gap-2">
            {/* Primary App Shell Nav */}
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBackClick}
                className="gap-2 h-8 px-3 font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Command Center</span>
              </Button>
            )}

            {/* Client Context */}
            {showClientSwitcher && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2.5 h-8 px-3 transition-all bg-primary/5 text-primary font-semibold">"""

content = content.replace(marker_header, replacement_header)

# Fix Client Dashboard container wrap and remove bold section backgrounds
# Earlier script modified some wrappers, let's fix the remaining ones + typography
content = content.replace(
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-violet-500 shadow-sm relative overflow-hidden"',
    'className="mt-6 mb-12"'
)
content = content.replace(
    '<div className="flex items-center gap-4 mb-6">',
    '<div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/60">'
)
content = content.replace(
    '<div className="p-3 rounded-xl bg-violet-500/20"><Share2 className="h-6 w-6 text-violet-600 dark:text-violet-400" /></div>',
    '<div className="p-2 rounded-lg bg-violet-500/10"><Share2 className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>'
)

# Ads
content = content.replace(
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-orange-500 shadow-sm mt-8 relative overflow-hidden"',
    'className="mt-12 mb-12"'
)
content = content.replace(
    '<div className="p-3 rounded-xl bg-orange-500/20"><BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" /></div>',
    '<div className="p-2 rounded-lg bg-orange-500/10"><BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div>'
)

# Web
content = content.replace(
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-emerald-500 shadow-sm mt-8 relative overflow-hidden"',
    'className="mt-12 mb-12"'
)
content = content.replace(
    '<div className="p-3 rounded-xl bg-emerald-500/20"><Globe className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /></div>',
    '<div className="p-2 rounded-lg bg-emerald-500/10"><Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>'
)

# SEO
content = content.replace(
    'className="rounded-2xl border border-border/50 bg-card p-6 md:p-8 border-l-4 border-l-slate-700 shadow-sm mt-8 relative overflow-hidden"',
    'className="mt-12 mb-12"'
)
content = content.replace(
    '<div className="p-3 rounded-xl bg-slate-500/20"><Globe className="h-6 w-6 text-slate-600 dark:text-slate-400" /></div>',
    '<div className="p-2 rounded-lg bg-slate-500/10"><Globe className="h-5 w-5 text-slate-600 dark:text-slate-400" /></div>'
)

with open('components/dashboard/ClientDashboardShell.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
