export type Role = "super_admin" | "supervisor" | "chief" | "ie";

export type Lang = "en" | "bn";

export interface Factory {
  id: string;
  name: string;
  code: string; // short business code, e.g. "RBC-1"
  city?: string;
  active: boolean;
}

export interface DowntimeReason {
  id: string;
  factoryId: string;
  label: string;
  active: boolean;
}

export interface DowntimeEvent {
  id: string;
  lineId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  reasonId: string;
  note?: string;
  enteredBy: string;
  enteredAt: string; // ISO
}

export type Currency = "INR" | "BDT";

export type WorkerClass = "operator" | "helper" | "pressman" | "checker";

export interface User {
  id: string;
  name: string;
  role: Role;
  lineIds: string[]; // lines the user supervises / owns
  factoryId?: string; // the factory this user belongs to (undefined for super_admin)
}

export interface Unit {
  id: string;
  name_en: string;
  name_bn: string;
}

export interface Floor {
  id: string;
  unitId: string;
  name_en: string;
  name_bn: string;
}

export interface Line {
  id: string;
  floorId: string;
  name_en: string;
  name_bn: string;
}

export interface Style {
  id: string;
  code: string;
  name: string;
  valuePerPcUsd: number; // stored in USD
}

export interface SalaryBankEntry {
  workerClass: WorkerClass;
  monthlySalaryUsd: number; // stored in USD
  workingDays: number; // for hourly-rate calc only
  standardHours: number; // for hourly-rate calc only
}

export interface PlannedWorkforceBreakdown {
  operators: number;
  helpers: number;
  pressmen: number;
  checkers: number;
}

export interface LineStyle {
  id: string;
  lineId: string;
  styleId: string;
  cmPerPcUsd: number; // stored in USD, entered by chief
  smv: number; // standard minutes per pc
  plannedWorkforce?: PlannedWorkforceBreakdown | number; // class breakdown or total headcount
  loadedAt: string; // ISO
  unloadedAt?: string;
  editedOnce?: boolean; // tracks if parameters were edited once for erroneous entry
  status?: "active" | "queued" | "closed";
}

export interface Attendance {
  lineId: string;
  date: string; // YYYY-MM-DD
  operators: number;
  helpers: number;
  pressmen: number;
  checkers: number;
}

export interface PlannedHeadcount {
  lineId: string;
  date: string;
  operators: number;
  helpers: number;
  pressmen: number;
  checkers: number;
}

export interface ProductionHour {
  id: string;
  lineId: string;
  styleId: string;
  date: string;
  hourSlot: string; // e.g. "08:00-09:00"
  goodQty: number;
  defectivePcs: number;
  totalDefects: number;
  enteredAt: string; // ISO
}

export type KpiKey =
  | "productivity"
  | "cost"
  | "efficiency"
  | "profit"
  | "changeover"
  | "absenteeism"
  | "defective"
  | "dhu";

export interface KpiThreshold {
  kpi: KpiKey;
  goodMin: number;
  watchMin: number;
  direction: "higher_is_better" | "lower_is_better";
}

export interface BreakSlot {
  id: string;
  name: string;
  type: "tea" | "lunch" | "prayer" | "other";
  unitId?: string; // "all" or unitId
  floorId?: string; // "all" or floorId
  startTime: string; // e.g. "10:15"
  endTime: string; // e.g. "10:30"
  durationMinutes: number; // e.g. 15
}

export interface ShiftConfig {
  start: string; // "08:00"
  end: string; // "17:00"
  breaks: BreakSlot[];
}

export interface AppSettings {
  displayCurrency: Currency;
  shift: ShiftConfig;
  thresholds: KpiThreshold[];
}

export type NodeLevel = "factory" | "unit" | "floor" | "line";

export type KpiStatus = "success" | "warning" | "danger";

export interface IeAlert {
  id: string;
  lineId: string;
  category: "production" | "defects" | "attendance" | "style";
  entryRef?: string;
  note: string;
  raisedBy: string;
  raisedAt: string;
  status: "open" | "resolved";
  // Supervisor resolution (populated once acted upon)
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}
