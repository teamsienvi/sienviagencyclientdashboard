import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldCheck, Clock, WifiOff } from "lucide-react";
import type { DataCoverageStatus, PlatformDataStatus } from "@/lib/analytics/comparison-contract.ts";

interface DataCoverageBadgeProps {
  rangeCompleteness: "complete" | "partial";
  dataCompleteness: DataCoverageStatus;
  reconciled: boolean;
  platformStatuses?: Array<{ platform: string; status: PlatformDataStatus }>;
}

export const DataCoverageBadge: React.FC<DataCoverageBadgeProps> = ({
  rangeCompleteness,
  dataCompleteness,
  reconciled,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* 1. Date Range Completeness */}
      <Badge
        className={
          rangeCompleteness === "complete"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 text-[10px]"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px]"
        }
      >
        <Clock className="h-3 w-3 mr-1" />
        {rangeCompleteness === "complete" ? "Date Range Complete" : "Partial Date Range"}
      </Badge>

      {/* 2. Metric Coverage */}
      <Badge
        className={
          dataCompleteness === "complete"
            ? "bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30 text-[10px]"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px]"
        }
      >
        {dataCompleteness === "complete" ? "All Platforms Reporting" : "Some Platforms Missing"}
      </Badge>

      {/* 3. Reconciled Gate Badge */}
      {reconciled ? (
        <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30 text-[10px] gap-1 font-bold">
          <ShieldCheck className="h-3 w-3 text-purple-500" />
          <span>Math Verified</span>
        </Badge>
      ) : (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30 text-[10px] gap-1 font-bold">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span>Totals Mismatch</span>
        </Badge>
      )}
    </div>
  );
};
