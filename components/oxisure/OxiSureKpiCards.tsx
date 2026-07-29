"use client";

import { Package, DollarSign, TrendingUp, BarChart, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { OxiOrderStats } from "@/types/oxisure";
import { useEffect, useRef, useState } from "react";

interface OxiSureKpiCardsProps {
  stats: OxiOrderStats;
}

/** Animated count-up hook — lerps from 0 to target over 800ms. */
function useCountUp(target: number, decimals = 0): string {
  const [display, setDisplay] = useState("0");
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const duration = 800;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;

      if (decimals > 0) {
        setDisplay(current.toFixed(decimals));
      } else {
        setDisplay(Math.round(current).toLocaleString());
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        if (decimals > 0) {
          setDisplay(target.toFixed(decimals));
        } else {
          setDisplay(target.toLocaleString());
        }
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, decimals]);

  return display;
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  prefix?: string;
  delay: number;
}

function KpiCard({ label, value, icon, prefix, delay }: KpiCardProps) {
  return (
    <Card
      className="saas-card saas-card-hover group relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Teal gradient accent on top edge */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-400 opacity-70 group-hover:opacity-100 transition-opacity" />
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500/20 transition-colors">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {prefix}{value}
        </p>
        <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Six KPI cards for OxiSure sales metrics.
 * Glassmorphic style with teal accents and animated count-up.
 */
export function OxiSureKpiCards({ stats }: OxiSureKpiCardsProps) {
  const totalOrders = useCountUp(stats.totalOrders);
  const totalRevenue = useCountUp(stats.totalRevenue, 2);
  const ordersThisMonth = useCountUp(stats.ordersThisMonth);
  const aov = useCountUp(stats.averageOrderValue, 2);
  const activeTrackers = useCountUp(stats.activeTrackers);
  const totalCustomers = useCountUp(stats.totalCustomers);

  const cards: Omit<KpiCardProps, "delay">[] = [
    {
      label: "Total Orders",
      value: totalOrders,
      icon: <Package className="h-4 w-4" />,
    },
    {
      label: "Total Revenue",
      value: totalRevenue,
      icon: <DollarSign className="h-4 w-4" />,
      prefix: "$",
    },
    {
      label: "Orders This Month",
      value: ordersThisMonth,
      icon: <TrendingUp className="h-4 w-4" />,
    },
    {
      label: "Avg Order Value",
      value: aov,
      icon: <BarChart className="h-4 w-4" />,
      prefix: "$",
    },
    {
      label: "Active Trackers",
      value: activeTrackers,
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Total Customers",
      value: totalCustomers,
      icon: <Users className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, i) => (
        <KpiCard key={card.label} {...card} delay={i * 80} />
      ))}
    </div>
  );
}
