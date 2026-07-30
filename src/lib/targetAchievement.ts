/**
 * Target Achievement KPI — pure computation.
 * No network, no store access. Works fully offline.
 */
import { countWorkingDays, tomorrow, addWorkingDays } from "./calendar";
import type { LineStyle, ProductionHour } from "@/types";

export interface TargetAchievement {
  orderQty: number;
  producedSoFar: number;
  remainingQty: number;
  plannedWorkingDays: number;
  plannedDailyTarget: number;
  actualWorkingDaysElapsed: number;
  remainingWorkingDays: number;
  movingTarget: number;
  todayActual: number;
  plannedAchievementPct: number;
  requiredAchievementPct: number;
  status: "on_track" | "slightly_behind" | "recovery_required";
  avgDailyOutput: number;
  projectedEndDate: string;
  delayDays: number;
  sewingEndDate: string;
  plannedStartDate: string;
  actualStartDate: string;
}

/**
 * Compute target achievement for an active line-style.
 * Returns null if the style has no order_qty or sewing_end_date.
 */
export function computeTargetAchievement(
  ls: LineStyle,
  production: ProductionHour[],
  today: string,
  weeklyOff: number[],
  holidays: string[],
): TargetAchievement | null {
  const orderQty = ls.orderQty;
  const sewingEndDate = ls.sewingEndDate;
  if (!orderQty || !sewingEndDate) return null;

  const plannedStartDate = ls.plannedStartDate ?? ls.loadedAt.slice(0, 10);
  const actualStartDate = ls.loadedAt.slice(0, 10);
  const holidayDates = holidays;

  // Planned working days (from planned start to end)
  const plannedWorkingDays = countWorkingDays(plannedStartDate, sewingEndDate, weeklyOff, holidayDates);
  const plannedDailyTarget = plannedWorkingDays > 0 ? orderQty / plannedWorkingDays : orderQty;

  // Actual working days elapsed (from actual start to today)
  const actualWorkingDaysElapsed = countWorkingDays(actualStartDate, today, weeklyOff, holidayDates);

  // Remaining working days (from tomorrow to end)
  const tmrw = tomorrow(today);
  const remainingWorkingDays = countWorkingDays(tmrw, sewingEndDate, weeklyOff, holidayDates);

  // Production totals for this style + line since actual start
  const relevantProduction = production.filter(
    (p) => p.styleId === ls.styleId && p.lineId === ls.lineId && p.date >= actualStartDate,
  );
  const producedSoFar = relevantProduction.reduce((sum, p) => sum + p.goodQty, 0);
  const remainingQty = Math.max(0, orderQty - producedSoFar);

  // Moving target
  const movingTarget = remainingWorkingDays > 0 ? remainingQty / remainingWorkingDays : remainingQty;

  // Today's actual
  const todayActual = relevantProduction
    .filter((p) => p.date === today)
    .reduce((sum, p) => sum + p.goodQty, 0);

  // Achievement percentages
  const plannedAchievementPct = plannedDailyTarget > 0
    ? Math.round((todayActual / plannedDailyTarget) * 1000) / 10
    : 0;
  const requiredAchievementPct = movingTarget > 0
    ? Math.round((todayActual / movingTarget) * 1000) / 10
    : 0;

  // Status
  const status: TargetAchievement["status"] =
    requiredAchievementPct >= 100 ? "on_track"
    : requiredAchievementPct >= 95 ? "slightly_behind"
    : "recovery_required";

  // Projected completion
  const avgDailyOutput = actualWorkingDaysElapsed > 0 ? producedSoFar / actualWorkingDaysElapsed : 0;
  const daysNeeded = avgDailyOutput > 0 ? Math.ceil(remainingQty / avgDailyOutput) : 999;
  const projectedEndDate = addWorkingDays(today, daysNeeded, weeklyOff, holidayDates);

  // Delay
  const delayDays = projectedEndDate > sewingEndDate
    ? countWorkingDays(tomorrow(sewingEndDate), projectedEndDate, weeklyOff, holidayDates)
    : 0;

  return {
    orderQty,
    producedSoFar,
    remainingQty,
    plannedWorkingDays,
    plannedDailyTarget: Math.round(plannedDailyTarget),
    actualWorkingDaysElapsed,
    remainingWorkingDays,
    movingTarget: Math.round(movingTarget),
    todayActual,
    plannedAchievementPct,
    requiredAchievementPct,
    status,
    avgDailyOutput: Math.round(avgDailyOutput),
    projectedEndDate,
    delayDays,
    sewingEndDate,
    plannedStartDate,
    actualStartDate,
  };
}
