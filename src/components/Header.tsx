import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Header = () => {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">
              SIENVI AGENCY
            </h1>
            <p className="text-sm text-primary mt-0.5">Client Dashboard</p>
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
