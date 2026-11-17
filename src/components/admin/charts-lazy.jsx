"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Charts use Recharts (~360 KB). Loading them on demand lets the dashboard
 * show immediately; each chart appears a moment later in place of a placeholder.
 */
function Placeholder() {
  return <Skeleton className="h-[260px] w-full rounded-lg" />;
}
export const RevenueChart = dynamic(() => import("./charts").then((m) => m.RevenueChart), { ssr: false, loading: Placeholder });
export const TrendAreaChart = dynamic(() => import("./charts").then((m) => m.TrendAreaChart), { ssr: false, loading: Placeholder });
export const SimpleLineChart = dynamic(() => import("./charts").then((m) => m.SimpleLineChart), { ssr: false, loading: Placeholder });
export const CategoryBarChart = dynamic(() => import("./charts").then((m) => m.CategoryBarChart), { ssr: false, loading: Placeholder });
export const HorizontalBarChart = dynamic(() => import("./charts").then((m) => m.HorizontalBarChart), { ssr: false, loading: Placeholder });
export const DonutChart = dynamic(() => import("./charts").then((m) => m.DonutChart), { ssr: false, loading: Placeholder });
