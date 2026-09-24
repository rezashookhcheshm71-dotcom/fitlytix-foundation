import {
  Area,
  AreaChart,
  Bar as RBar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DnaDimension, PerformancePoint } from "@/domain/types";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
  direction: "ltr" as const,
};

export function PerformanceTrendChart({ data, height = 220 }: { data: PerformancePoint[]; height?: number }) {
  return (
    <div style={{ height, direction: "ltr" }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="pi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="eng" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
          <XAxis dataKey="week" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[40, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "oklch(1 0 0 / 15%)" }} />
          <Area type="monotone" dataKey="engine" name="Engine" stroke="var(--chart-2)" strokeWidth={2} fill="url(#eng)" />
          <Area type="monotone" dataKey="strength" name="Strength" stroke="var(--chart-3)" strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="performanceIndex" name="Performance Index" stroke="var(--chart-1)" strokeWidth={3} fill="url(#pi)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DnaRadarChart({ dimensions, height = 300, compact }: { dimensions: DnaDimension[]; height?: number; compact?: boolean }) {
  const data = dimensions.map((d) => ({ subject: compact ? d.label : `${d.label}`, score: d.score, full: 100 }));
  return (
    <div style={{ height, direction: "ltr" }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius={compact ? "70%" : "78%"}>
          <PolarGrid stroke="oklch(1 0 0 / 10%)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted-foreground)", fontSize: compact ? 10 : 12 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="var(--primary)" strokeWidth={2.5} fill="var(--primary)" fillOpacity={0.28} dot={{ r: 3, fill: "var(--primary)" }} />
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecoveryBars({ data, height = 120 }: { data: { day: string; readiness: number }[]; height?: number }) {
  return (
    <div style={{ height, direction: "ltr" }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(1 0 0 / 5%)" }} />
          <RBar dataKey="readiness" name="Readiness" radius={[6, 6, 6, 6]} fill="var(--success)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
