import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import sienviLogo from "@/assets/sienvi-agency-client-logo.jpg";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 animate-fade-in">
            <div className="relative group">
              <div className="absolute -inset-1 bg-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <img 
                src={sienviLogo} 
                alt="SIENVI Agency Logo" 
                className="relative h-16 w-16 object-contain rounded-xl shadow-sm"
              />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground uppercase tracking-tight">
                SIENVI AGENCY
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-medium">Client Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Live Data</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
};
