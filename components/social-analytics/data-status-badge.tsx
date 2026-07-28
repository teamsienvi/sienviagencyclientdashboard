import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, WifiOff } from "lucide-react";
import type { PlatformDataStatus } from "@/types/social-analytics";

interface DataStatusBadgeProps {
  status: PlatformDataStatus;
  label?: string;
}

export const DataStatusBadge: React.FC<DataStatusBadgeProps> = ({ status, label }) => {
  if (status === "connected") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold gap-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        <span>{label || "Live"}</span>
      </Badge>
    );
  }

  if (status === "delayed") {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-semibold gap-1">
        <Clock className="h-3 w-3 text-amber-500" />
        <span>{label || "Sync Delayed"}</span>
      </Badge>
    );
  }

  if (status === "disconnected") {
    return (
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-semibold gap-1">
        <WifiOff className="h-3 w-3 text-rose-500" />
        <span>{label || "Disconnected"}</span>
      </Badge>
    );
  }

  return (
    <Badge className="bg-muted text-muted-foreground border border-border text-[10px] font-semibold gap-1">
      <AlertTriangle className="h-3 w-3 text-muted-foreground" />
      <span>{label || "Unavailable"}</span>
    </Badge>
  );
};
