import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface WoWMetricCardProps {
  icon: React.ReactNode;
  label: string;
  currentValue: number | null | undefined;
  previousValue?: number | null;
  /** 
   * Format for displaying the change:
   * - 'number': Shows absolute difference (e.g., +150)
   * - 'percent': Shows percentage change (e.g., +25.5%)
   * - 'pp': Shows percentage points for rates (e.g., +2.5pp)
   */
  changeFormat?: 'number' | 'percent' | 'pp';
  /** Unit to display after the value (e.g., '%', 'min') */
  valueUnit?: string;
  /** Number of decimal places for the value */
  valueDecimals?: number;
  /** Show 'Live' badge */
  isLive?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Custom formatter for the main value */
  formatValue?: (value: number) => string;
  /** Additional class names */
  className?: string;
}

export const formatNumber = (value: number | null | undefined): string => {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

export const WoWMetricCard = ({
  icon,
  label,
  currentValue,
  previousValue,
  changeFormat = 'number',
  valueUnit = '',
  valueDecimals = 0,
  isLive = false,
  isLoading = false,
  formatValue,
  className,
}: WoWMetricCardProps) => {
  const renderTrendIndicator = () => {
    if (currentValue == null || previousValue == null) return null;
    
    const diff = currentValue - previousValue;
    
    if (diff === 0) {
      return (
        <div className="flex items-center text-xs text-muted-foreground gap-0.5">
          <Minus className="h-3 w-3" />
          <span>0{changeFormat === 'pp' ? 'pp' : changeFormat === 'percent' ? '%' : ''}</span>
        </div>
      );
    }
    
    let displayChange: string;
    
    if (changeFormat === 'pp') {
      // Percentage points - show absolute difference with pp suffix
      displayChange = `${diff > 0 ? '+' : ''}${diff.toFixed(2)}pp`;
    } else if (changeFormat === 'percent') {
      // Percentage change relative to previous value
      const percentChange = previousValue !== 0 ? ((diff / previousValue) * 100).toFixed(1) : "0";
      displayChange = `${diff > 0 ? '+' : ''}${percentChange}%`;
    } else {
      // Absolute number change
      displayChange = `${diff > 0 ? '+' : ''}${formatNumber(diff)}`;
    }
    
    const isPositive = diff > 0;
    
    return (
      <div className={cn(
        "flex items-center text-xs gap-0.5",
        isPositive ? "text-green-500" : "text-red-500"
      )}>
        {isPositive ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
        <span>{displayChange}</span>
      </div>
    );
  };
  
  const displayValue = () => {
    if (currentValue == null) return "—";
    
    if (formatValue) {
      return formatValue(currentValue);
    }
    
    if (valueDecimals > 0) {
      return currentValue.toFixed(valueDecimals) + valueUnit;
    }
    
    return formatNumber(currentValue) + valueUnit;
  };
  
  const displayPreviousValue = () => {
    if (previousValue == null) return null;
    
    if (formatValue) {
      return formatValue(previousValue);
    }
    
    if (valueDecimals > 0) {
      return previousValue.toFixed(valueDecimals) + valueUnit;
    }
    
    return formatNumber(previousValue) + valueUnit;
  };

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-sm">{label}</span>
          {isLive && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">Live</Badge>
          )}
        </div>
        
        {isLoading ? (
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <p className="text-2xl font-bold">{displayValue()}</p>
            
            {previousValue != null && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  vs {displayPreviousValue()} (prev week)
                </span>
                {renderTrendIndicator()}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WoWMetricCard;
