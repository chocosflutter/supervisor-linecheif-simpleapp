/**
 * Target Achievement KPI — pure computation.
 * No network, no store access. Works fully offline.
 *
 * FORMULA:
 * - hourly_target = remaining_order / remaining_working_hours (recalculates after every hour)
 * - working_hours_per_day = (shift_end - shift_start) - sum(break_durations) [net production hours]
 * - total_working_hours = working_days × working_hours_per_day
 * - achievement % = total_produced / sum_of_moving_targets_for_hours_worked × 100
 */
import { countWorkingDays, tomorrow, addWorkingDays } from "./calendar";
import type { LineStyle, ProductionHour, ShiftConfig } from "@/types";

export interface TargetAchievement {
  orderQty: number;
  producedSoFar: number;
  remainingQty: number;
  workingHoursPerDay: number;
  totalWorkingHours: number;
  plannedWorkingDays: number;
  originalHourlyTarget: number;
  currentMovingHourlyTarget: number;
  dailyTarget: number;
  movingDailyTarget: number;
  hoursWorkedToday: number;
  todayActual: number;
  todayTargetSum: number; // sum of moving targets for today's hours
  achievementPct: number; // overall: produced / sum_all_moving_targets
  todayAchievementPct: number;
  status: "on_track" | "slightly_behind" | "recovery_required";
  remainingWorkingDays: number;
  remainingHours: number;
  avgHourlyOutput: number;
  projectedEndDate: string;
  delayDays: number;
  sewingEndDate: string;
  plannedStartDate: string;
  actualStartDate: string;
  aheadBehindPcs: number; // positive = ahead, negative = behind
  // For charts
  hourlyBreakdown: { hour: string; target: number; actual: number; achievementPct: number }[];
}

/**
 * Calculate net working hours per day from shift config.
 * = (shift_end - shift_start) in hours - sum(break durations in hours)
 */
export function getWorkingHoursPerDay(shift: ShiftConfig): number {
  const [sh, sm] = shift.start.split(":").map(Number);
  const [eh, em] = shift.end.split(":").map(Number);
  const shiftMinutes = (eh * 60 + em) - (sh * 60 + sm);
  const breakMinutes = (shift.breaks ?? []).reduce((sum, b) => sum + b.durationMinutes, 0);
  return (shiftMinutes - breakMinutes) / 60;
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
  shift: ShiftConfig,
): TargetAchievement | null {
  const orderQty = ls.orderQty;
  const sewingEndDate = ls.sewingEndDate;
  if (!orderQty || !sewingEndDate) return null;

  const plannedStartDate = ls.plannedStartDate ?? ls.loadedAt.slice(0, 10);
  const actualStartDate = ls.loadedAt.slice(0, 10);

  // Working hours per day (net of breaks)
  const workingHoursPerDay = getWorkingHoursPerDay(shift);

  // Working days
  const plannedWorkingDays = countWorkingDays(plannedStartDate, sewingEndDate, weeklyOff, holidays);
  const remainingWorkingDays = countWorkingDays(tomorrow(today), sewingEndDate, weeklyOff, holidays);

  // Total working hours for the order
  const totalWorkingHours = plannedWorkingDays * workingHoursPerDay;
  const remainingHours = remainingWorkingDays * workingHoursPerDay;

  // Original targets
  const originalHourlyTarget = totalWorkingHours > 0 ? orderQty / totalWorkingHours : orderQty;
  const dailyTarget = originalHourlyTarget * workingHoursPerDay;

  // Get all production for this style+line since actual start
  const relevantProduction = production
    .filter((p) => p.styleId === ls.styleId && p.lineId === ls.lineId && p.date >= actualStartDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.hourSlot.localeCompare(b.hourSlot));

  const producedSoFar = relevantProduction.reduce((sum, p) => sum + p.goodQty, 0);
  const remainingQty = Math.max(0, orderQty - producedSoFar);

  // Compute moving targets for each hour worked (the core recalculating logic)
  let remaining = orderQty;
  let remHrs = totalWorkingHours;
  let sumMovingTargets = 0;
  const hourlyBreakdown: TargetAchievement["hourlyBreakdown"] = [];

  for (const p of relevantProduction) {
    const movingTarget = remHrs > 0 ? remaining / remHrs : remaining;
    sumMovingTargets += movingTarget;
    const ach = movingTarget > 0 ? (p.goodQty / movingTarget) * 100 : 0;
    hourlyBreakdown.push({
      hour: `${p.date.slice(5)} ${p.hourSlot.slice(0, 5)}`,
      target: Math.round(movingTarget * 10) / 10,
      actual: p.goodQty,
      achievementPct: Math.round(ach * 10) / 10,
    });
    remaining = Math.max(0, remaining - p.goodQty);
    remHrs = Math.max(0, remHrs - 1);
  }

  // Today's specific data
  const todayProduction = relevantProduction.filter((p) => p.date === today);
  const todayActual = todayProduction.reduce((sum, p) => sum + p.goodQty, 0);
  const hoursWorkedToday = todayProduction.length;

  // Today's sum of moving targets (from the hourly breakdown)
  const todayHourlyBreakdown = hourlyBreakdown.filter((h) => h.hour.startsWith(today.slice(5)));
  const todayTargetSum = todayHourlyBreakdown.reduce((sum, h) => sum + h.target, 0);

  // Achievement percentages
  const achievementPct = sumMovingTargets > 0 ? Math.round((producedSoFar / sumMovingTargets) * 1000) / 10 : 0;
  const todayAchievementPct = todayTargetSum > 0 ? Math.round((todayActual / todayTargetSum) * 1000) / 10 : 0;

  // Current moving targets
  const currentMovingHourlyTarget = remHrs > 0 ? remaining / remHrs : remaining;
  const movingDailyTarget = currentMovingHourlyTarget * workingHoursPerDay;

  // Status (based on overall achievement)
  const status: TargetAchievement["status"] =
    achievementPct >= 100 ? "on_track"
    : achievementPct >= 95 ? "slightly_behind"
    : "recovery_required";

  // Ahead/behind in pcs
  const aheadBehindPcs = Math.round(producedSoFar - sumMovingTargets);

  // Projected completion
  const totalHoursWorked = relevantProduction.length;
  const avgHourlyOutput = totalHoursWorked > 0 ? producedSoFar / totalHoursWorked : 0;
  const hoursNeeded = avgHourlyOutput > 0 ? Math.ceil(remainingQty / avgHourlyOutput) : 999;
  const daysNeeded = Math.ceil(hoursNeeded / workingHoursPerDay);
  const projectedEndDate = addWorkingDays(today, daysNeeded, weeklyOff, holidays);
  const delayDays = projectedEndDate > sewingEndDate
    ? countWorkingDays(tomorrow(sewingEndDate), projectedEndDate, weeklyOff, holidays)
    : 0;

  return {
    orderQty,
    producedSoFar,
    remainingQty,
    workingHoursPerDay,
    totalWorkingHours,
    plannedWorkingDays,
    originalHourlyTarget: Math.round(originalHourlyTarget * 10) / 10,
    currentMovingHourlyTarget: Math.round(currentMovingHourlyTarget * 10) / 10,
    dailyTarget: Math.round(dailyTarget),
    movingDailyTarget: Math.round(movingDailyTarget),
    hoursWorkedToday,
    todayActual,
    todayTargetSum: Math.round(todayTargetSum * 10) / 10,
    achievementPct,
    todayAchievementPct,
    status,
    remainingWorkingDays,
    remainingHours,
    avgHourlyOutput: Math.round(avgHourlyOutput * 10) / 10,
    projectedEndDate,
    delayDays,
    sewingEndDate,
    plannedStartDate,
    actualStartDate,
    aheadBehindPcs,
    hourlyBreakdown,
  };
}
