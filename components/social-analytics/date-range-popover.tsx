import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, isBefore, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { DateRangePreset } from "@/types/social-analytics";

interface PresetOption {
  id: DateRangePreset;
  label: string;
}

interface DateRangePopoverProps {
  label: string;
  from?: Date;
  to?: Date;
  onChange: (range: { start: Date; end: Date } | null) => void;
  /** Max selectable date (defaults to yesterday) */
  maxDate?: Date;
  /** Visual variant for header dark theme */
  variant?: "current" | "comparison";
  /** Preset shortcuts to show inside the popover (only for current period picker) */
  presets?: PresetOption[];
  /** Currently active preset */
  activePreset?: DateRangePreset;
  /** Callback when a preset shortcut is clicked */
  onPresetSelect?: (preset: DateRangePreset) => void;
}

export const DateRangePopover: React.FC<DateRangePopoverProps> = ({
  label,
  from,
  to,
  onChange,
  maxDate,
  variant = "current",
  presets,
  activePreset,
  onPresetSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(
    from && to ? { from, to } : undefined
  );

  // Sync external prop changes (e.g. when preset is clicked)
  useEffect(() => {
    setRange(from && to ? { from, to } : undefined);
  }, [from?.getTime(), to?.getTime()]);

  const yesterday = startOfDay(subDays(new Date(), 1));
  const effectiveMax = maxDate || yesterday;

  const handleApply = () => {
    if (range?.from && range?.to) {
      // Ensure from is before to
      const [start, end] = isBefore(range.from, range.to)
        ? [range.from, range.to]
        : [range.to, range.from];
      onChange({ start, end });
    }
    setOpen(false);
  };

  const handleClear = () => {
    setRange(undefined);
    onChange(null);
    setOpen(false);
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    onPresetSelect?.(preset);
    setOpen(false);
  };

  const pillLabel =
    from && to
      ? formatRangeLabel(from, to)
      : `Select ${label}…`;

  const pillBorderClass =
    variant === "current"
      ? "border-violet-500/40 hover:border-violet-400/60"
      : "border-slate-500/40 hover:border-slate-400/60";
  const pillBgClass =
    variant === "current"
      ? "bg-violet-500/10 hover:bg-violet-500/20"
      : "bg-slate-500/10 hover:bg-slate-500/20";

  const hasPresets = presets && presets.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${pillBorderClass} ${pillBgClass} text-white/90 hover:text-white`}
        >
          <CalendarIcon className={`h-3 w-3 ${variant === "current" ? "text-violet-400" : "text-slate-400"}`} />
          <span className="whitespace-nowrap">{pillLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-slate-900 border-slate-700/60 shadow-2xl rounded-xl"
        align="end"
        sideOffset={8}
      >
        <div className="p-3 border-b border-slate-700/40">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {range?.from && range?.to
              ? formatRangeLabel(range.from, range.to)
              : "Click two dates to set a range"}
          </p>
        </div>

        <div className={hasPresets ? "flex" : ""}>
          {/* Preset shortcuts sidebar */}
          {hasPresets && (
            <div className="w-36 border-r border-slate-700/40 p-2 flex flex-col gap-0.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-2 py-1">
                Quick Select
              </p>
              {presets.map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetClick(p.id)}
                    className={`text-left px-2.5 py-1.5 text-xs rounded-md transition-all ${
                      isActive
                        ? "bg-violet-600/30 text-violet-200 font-semibold border border-violet-500/30"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Calendar */}
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={2}
            disabled={{ after: effectiveMax }}
            defaultMonth={range?.from || new Date()}
            className="p-3"
            classNames={{
              months: "flex flex-col sm:flex-row gap-2",
              month: "space-y-3",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-xs font-semibold text-slate-200",
              nav_button:
                "h-6 w-6 bg-transparent hover:bg-white/10 rounded-md flex items-center justify-center text-slate-400 hover:text-white transition-colors",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell:
                "text-slate-500 rounded-md w-8 font-normal text-[10px] uppercase",
              row: "flex w-full mt-1",
              cell: "h-8 w-8 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-violet-500/10 [&:has([aria-selected])]:bg-violet-500/15 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-8 w-8 p-0 font-normal text-slate-300 hover:bg-white/10 rounded-md transition-colors aria-selected:opacity-100",
              day_range_end: "day-range-end",
              day_selected:
                "bg-violet-600 text-white hover:bg-violet-500 focus:bg-violet-600 focus:text-white rounded-md",
              day_today:
                "bg-white/10 text-white font-semibold",
              day_outside:
                "day-outside text-slate-600 opacity-50 aria-selected:bg-violet-500/10 aria-selected:text-slate-400",
              day_disabled: "text-slate-700 opacity-40",
              day_range_middle:
                "aria-selected:bg-violet-500/15 aria-selected:text-violet-200 rounded-none",
              day_hidden: "invisible",
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 p-3 border-t border-slate-700/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-white hover:bg-white/10 h-7 px-2.5"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!range?.from || !range?.to}
            className="text-xs bg-violet-600 hover:bg-violet-500 text-white h-7 px-4 font-semibold disabled:opacity-40"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Format a date range into a compact Shopify-style label */
function formatRangeLabel(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (sameMonth) {
    return `${format(from, "MMM d")}–${format(to, "d, yyyy")}`;
  }
  if (sameYear) {
    return `${format(from, "MMM d")}–${format(to, "MMM d, yyyy")}`;
  }
  return `${format(from, "MMM d, yyyy")}–${format(to, "MMM d, yyyy")}`;
}
