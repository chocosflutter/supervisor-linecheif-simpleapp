import type {
  Attendance,
  AppSettings,
  DowntimeEvent,
  DowntimeReason,
  Factory,
  Floor,
  Line,
  LineStyle,
  PlannedHeadcount,
  ProductionHour,
  SalaryBankEntry,
  Style,
  Unit,
  User,
} from "@/types";

export const TODAY = new Date().toISOString().slice(0, 10);

// Multi-factory: Super Admin creates factories + all logins. Mock has one factory.
export const FACTORY_ID = "fac1";

export const factories: Factory[] = [
  { id: "fac1", name: "RBC Apparels — Unit Complex 1", code: "RBC-1", city: "Dhaka", active: true },
  { id: "fac2", name: "RBC Apparels — Unit Complex 2", code: "RBC-2", city: "Chattogram", active: true },
];

export const downtimeReasons: DowntimeReason[] = [
  { id: "dr1", factoryId: FACTORY_ID, label: "Machine breakdown", active: true },
  { id: "dr2", factoryId: FACTORY_ID, label: "Power cut", active: true },
  { id: "dr3", factoryId: FACTORY_ID, label: "No feeding / input shortage", active: true },
  { id: "dr4", factoryId: FACTORY_ID, label: "Maintenance", active: true },
  { id: "dr5", factoryId: FACTORY_ID, label: "Other", active: true },
];

export const downtime: DowntimeEvent[] = [
  {
    id: "dt1",
    lineId: "l1",
    date: TODAY,
    startTime: "10:20",
    endTime: "10:45",
    reasonId: "dr1",
    note: "Needle plate jam on station 6",
    enteredBy: "Rahim (Supervisor)",
    enteredAt: `${TODAY}T10:46:00Z`,
  },
];

// FX: base USD. (Mock rates; Phase 2 fetches from open.er-api.com)
export const FX_RATES: Record<string, number> = {
  INR: 83.2,
  BDT: 119.5,
};

export const units: Unit[] = [
  { id: "u1", name_en: "Unit 1", name_bn: "ইউনিট ১" },
  { id: "u2", name_en: "Unit 2", name_bn: "ইউনিট ২" },
];

export const floors: Floor[] = [
  { id: "f1", unitId: "u1", name_en: "Floor A", name_bn: "ফ্লোর এ" },
  { id: "f2", unitId: "u1", name_en: "Floor B", name_bn: "ফ্লোর বি" },
  { id: "f3", unitId: "u2", name_en: "Floor C", name_bn: "ফ্লোর সি" },
];

export const lines: Line[] = [
  { id: "l1", floorId: "f1", name_en: "Line 1", name_bn: "লাইন ১" },
  { id: "l2", floorId: "f1", name_en: "Line 2", name_bn: "লাইন ২" },
  { id: "l3", floorId: "f2", name_en: "Line 3", name_bn: "লাইন ৩" },
  { id: "l4", floorId: "f2", name_en: "Line 4", name_bn: "লাইন ৪" },
  { id: "l5", floorId: "f3", name_en: "Line 5", name_bn: "লাইন ৫" },
  { id: "l6", floorId: "f3", name_en: "Line 6", name_bn: "লাইন ৬" },
];

export const styles: Style[] = [
  { id: "s1", code: "PL-2201", name: "Basic Polo", valuePerPcUsd: 4.5 },
  { id: "s2", code: "TS-3310", name: "Crew Tee", valuePerPcUsd: 3.2 },
  { id: "s3", code: "HD-7788", name: "Pullover Hoodie", valuePerPcUsd: 8.9 },
];

export const salaryBank: SalaryBankEntry[] = [
  { workerClass: "operator", monthlySalaryUsd: 150, workingDays: 26, standardHours: 8 },
  { workerClass: "helper", monthlySalaryUsd: 110, workingDays: 26, standardHours: 8 },
  { workerClass: "pressman", monthlySalaryUsd: 140, workingDays: 26, standardHours: 8 },
  { workerClass: "checker", monthlySalaryUsd: 130, workingDays: 26, standardHours: 8 },
];

// Currently loaded style per line (chief-entered CM + SMV)
export const lineStyles: LineStyle[] = [
  { id: "ls1", lineId: "l1", styleId: "s1", cmPerPcUsd: 1.2, smv: 14, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T02:00:00Z`, status: "active" },
  { id: "ls1-queued", lineId: "l1", styleId: "s2", cmPerPcUsd: 0.95, smv: 10, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T04:00:00Z`, status: "queued" },
  { id: "ls2", lineId: "l2", styleId: "s2", cmPerPcUsd: 0.9, smv: 10, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T02:00:00Z`, status: "active" },
  { id: "ls3", lineId: "l3", styleId: "s3", cmPerPcUsd: 2.1, smv: 24, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T02:00:00Z`, status: "active" },
  { id: "ls4", lineId: "l4", styleId: "s1", cmPerPcUsd: 1.15, smv: 14, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T02:00:00Z`, status: "active" },
  { id: "ls5", lineId: "l5", styleId: "s2", cmPerPcUsd: 0.95, smv: 10, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T02:00:00Z`, status: "active" },
  { id: "ls6", lineId: "l6", styleId: "s3", cmPerPcUsd: 2.0, smv: 24, plannedWorkforce: { operators: 24, helpers: 6, pressmen: 3, checkers: 3 }, loadedAt: `${TODAY}T02:00:00Z`, status: "active" },
];

export const plannedHeadcount: PlannedHeadcount[] = lines.map((l) => ({
  lineId: l.id,
  date: TODAY,
  operators: 24,
  helpers: 6,
  pressmen: 3,
  checkers: 3,
}));

// Attendance filled for most lines; l1 intentionally NOT filled to demo the gate.
export const attendance: Attendance[] = [
  { lineId: "l1", date: TODAY, operators: 24, helpers: 6, pressmen: 3, checkers: 3 },
  { lineId: "l2", date: TODAY, operators: 23, helpers: 6, pressmen: 3, checkers: 3 },
  { lineId: "l3", date: TODAY, operators: 22, helpers: 5, pressmen: 3, checkers: 2 },
  { lineId: "l4", date: TODAY, operators: 24, helpers: 6, pressmen: 2, checkers: 3 },
  { lineId: "l5", date: TODAY, operators: 21, helpers: 6, pressmen: 3, checkers: 3 },
  { lineId: "l6", date: TODAY, operators: 24, helpers: 6, pressmen: 3, checkers: 3 },
];

function makeHours(lineId: string, styleId: string, base: number): ProductionHour[] {
  const slots = ["08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "13:00-14:00"];
  return slots.map((slot, i) => {
    const good = base + Math.round(Math.sin(i) * 12) + i * 3;
    const defective = Math.max(1, Math.round(good * 0.03));
    return {
      id: `${lineId}-${i}`,
      lineId,
      styleId,
      date: TODAY,
      hourSlot: slot,
      goodQty: good,
      defectivePcs: defective,
      totalDefects: defective + Math.round(good * 0.02),
      enteredAt: `${TODAY}T0${i + 3}:15:00Z`,
    };
  });
}

export const production: ProductionHour[] = [
  ...makeHours("l1", "s1", 100),
  ...makeHours("l2", "s2", 120),
  ...makeHours("l3", "s3", 70),
  ...makeHours("l4", "s1", 95),
  ...makeHours("l5", "s2", 110),
  ...makeHours("l6", "s3", 65),
];

export const users: User[] = [
  { id: "super1", name: "Super Admin", role: "super_admin", lineIds: [] },
  { id: "sup1", name: "Rahim (Supervisor)", role: "supervisor", lineIds: ["l1"], factoryId: FACTORY_ID },
  { id: "chief1", name: "Karim (Line Chief)", role: "chief", lineIds: ["l1", "l2", "l3", "l4"], factoryId: FACTORY_ID },
  { id: "ie1", name: "Anita (IE)", role: "ie", lineIds: ["l1", "l2", "l3", "l4", "l5", "l6"], factoryId: FACTORY_ID },
];

export const defaultBreaks = [
  { id: "b1", name: "Morning Tea Break", type: "tea" as const, unitId: "all", floorId: "all", startTime: "10:15", endTime: "10:30", durationMinutes: 15 },
  { id: "b2", name: "Unit 1 Lunch Break", type: "lunch" as const, unitId: "u1", floorId: "f1", startTime: "12:00", endTime: "13:00", durationMinutes: 60 },
  { id: "b3", name: "Unit 2 Lunch Break", type: "lunch" as const, unitId: "u2", floorId: "f3", startTime: "12:30", endTime: "13:30", durationMinutes: 60 },
  { id: "b4", name: "Afternoon Tea Break", type: "tea" as const, unitId: "all", floorId: "all", startTime: "15:15", endTime: "15:30", durationMinutes: 15 },
];

export const defaultSettings: AppSettings = {
  displayCurrency: "BDT",
  shift: { start: "08:00", end: "17:00", breaks: defaultBreaks },
  thresholds: [
    { kpi: "productivity", goodMin: 800, watchMin: 500, direction: "higher_is_better" },
    { kpi: "cost", goodMin: 0.6, watchMin: 1.0, direction: "lower_is_better" },
    { kpi: "efficiency", goodMin: 70, watchMin: 50, direction: "higher_is_better" },
    { kpi: "profit", goodMin: 200, watchMin: 50, direction: "higher_is_better" },
    { kpi: "changeover", goodMin: 30, watchMin: 60, direction: "lower_is_better" },
    { kpi: "absenteeism", goodMin: 5, watchMin: 12, direction: "lower_is_better" },
    { kpi: "defective", goodMin: 3, watchMin: 6, direction: "lower_is_better" },
    { kpi: "dhu", goodMin: 5, watchMin: 10, direction: "lower_is_better" },
  ],
};
