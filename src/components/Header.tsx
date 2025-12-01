import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import sienviLogo from "@/assets/sienvi-logo.jpg";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 animate-fade-in">
            <div className="relative">
              <img 
                src={sienviLogo} 
                alt="SIENVI Agency Logo" 
                className="h-16 w-16 object-contain rounded-xl shadow-sm"
              />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground uppercase tracking-tight">
                SIENVI AGENCY
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-medium">Client Dashboard</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 hover:bg-primary/5 transition-all duration-200">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Live Data</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
