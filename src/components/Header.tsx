import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import sienviLogo from "@/assets/sienvi-logo.jpg";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={sienviLogo} 
              alt="SIENVI Agency Logo" 
              className="h-14 w-14 object-contain rounded-lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">
                SIENVI AGENCY
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Client Dashboard</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Activity className="h-4 w-4" />
            Live Data
          </Button>
        </div>
      </div>
    </header>
  );
};
