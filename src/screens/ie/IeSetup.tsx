import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Building2,
  Coins,
  SlidersHorizontal,
  Clock,
  Plus,
  Edit2,
  Trash2,
  X,
  Building,
  AlertTriangle,
  DollarSign,
  Coffee,
  CheckCircle2,
  Utensils,
  Layers,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/store/appStore";

import { money } from "@/lib/format";
import { unitName, floorName, lineName } from "@/lib/names";
import GlassCard from "@/components/GlassCard";
import CustomTimePicker from "@/components/CustomTimePicker";
import type { KpiKey, SalaryBankEntry } from "@/types";
import { FACTORY_ID } from "@/data/mock";

/* ================================================================== */
/*                   Downtime Reasons Inline (Tab 6)                  */
/* ================================================================== */
function DowntimeReasonsInline() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user);
  const reasons = useApp((s) => s.downtimeReasons);
  const addDowntimeReason = useApp((s) => s.addDowntimeReason);
  const toggleDowntimeReason = useApp((s) => s.toggleDowntimeReason);

  const factoryId = user?.factoryId ?? FACTORY_ID;
  const factoryReasons = reasons.filter((r) => r.factoryId === factoryId);

  const [label, setLabel] = useState("");

  const add = () => {
    const clean = label.trim();
    if (!clean) return;
    addDowntimeReason({ id: `dr-${Date.now()}`, factoryId, label: clean, active: true });
    setLabel("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <AlertTriangle size={16} className="text-state-warning" />
          <span>{t("downtime.reasonsTitle")}</span>
        </h2>
      </div>
      <p className="text-xs text-ink-muted">{t("downtime.reasonsSubtitle")}</p>

      <GlassCard level="solid" hairline className="p-4 space-y-3 border border-slate-200">
        <label className="block font-semibold text-ink text-xs">{t("downtime.reasonLabel")}</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. Thread break, Fabric shortage..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={add}
            disabled={!label.trim()}
            className="px-4 py-2.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition disabled:opacity-50"
          >
            <Plus size={14} />
            <span>{t("downtime.addReason")}</span>
          </button>
        </div>
      </GlassCard>

      <div className="space-y-2">
        {factoryReasons.map((r) => (
          <GlassCard
            key={r.id}
            level={2}
            className={`p-3 flex items-center justify-between border border-slate-100 ${r.active ? "" : "opacity-60"}`}
          >
            <span className="text-sm font-semibold text-ink">{r.label}</span>
            <button
              onClick={() => toggleDowntimeReason(r.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 border active:scale-95 ${
                r.active
                  ? "text-state-success bg-state-success/10 border-state-success/20"
                  : "text-ink-muted bg-slate-100 border-slate-200"
              }`}
            >
              {r.active ? <CheckCircle2 size={13} /> : <X size={13} />}
              <span>{r.active ? "Active" : "Inactive"}</span>
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*                      Setup Modals Components                       */
/* ================================================================== */

// Modal 1: Add Unit / Add Floor / Add Line
interface AddEntityModalProps {
  type: "unit" | "floor" | "line";
  parentId?: string;
  onClose: () => void;
}

function AddEntityModal({ type, parentId, onClose }: AddEntityModalProps) {
  const units = useApp((s) => s.units);
  const floors = useApp((s) => s.floors);
  const lines = useApp((s) => s.lines);
  const addUnit = useApp((s) => s.addUnit);
  const addFloor = useApp((s) => s.addFloor);
  const addLine = useApp((s) => s.addLine);

  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");

  const handleSave = () => {
    if (!nameEn.trim()) return;
    const cleanEn = nameEn.trim();
    const cleanBn = nameBn.trim() || cleanEn;

    if (type === "unit") {
      const id = `u${units.length + 1}`;
      addUnit({ id, name_en: cleanEn, name_bn: cleanBn });
    } else if (type === "floor") {
      const id = `f${floors.length + 1}`;
      addFloor({ id, unitId: parentId || "u1", name_en: cleanEn, name_bn: cleanBn });
    } else if (type === "line") {
      const id = `l${lines.length + 1}`;
      addLine({ id, floorId: parentId || "f1", name_en: cleanEn, name_bn: cleanBn });
    }
    onClose();
  };

  const title =
    type === "unit"
      ? "Add New Factory Unit"
      : type === "floor"
      ? "Add New Floor"
      : "Add New Sewing Line";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-ink">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">Name (English)</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={type === "unit" ? "Unit 3" : type === "floor" ? "Floor D" : "Line 7"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Name (Bengali - Optional)</label>
            <input
              type="text"
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
              placeholder={type === "unit" ? "ইউনিট ৩" : type === "floor" ? "ফ্লোর ডি" : "লাইন ৭"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!nameEn.trim()}
            className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm disabled:opacity-50"
          >
            Save & Create
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal 2: Create Break From Category Pill
interface CreateBreakFromPillModalProps {
  category: "tea" | "lunch" | "prayer" | "maintenance" | "custom";
  unitId: string;
  floorId: string;
  onClose: () => void;
}

function CreateBreakFromPillModal({
  category,
  unitId,
  floorId,
  onClose,
}: CreateBreakFromPillModalProps) {
  const addBreakSlot = useApp((s) => s.addBreakSlot);
  const lang = useApp((s) => s.lang);

  const defaultDuration = category === "lunch" ? 60 : category === "tea" ? 15 : 30;
  const defaultStartTime = category === "lunch" ? "12:00" : category === "tea" ? "10:15" : "15:00";
  const defaultReason =
    category === "lunch"
      ? "Lunch Break"
      : category === "tea"
      ? "Tea Break"
      : category === "prayer"
      ? "Prayer Break"
      : category === "maintenance"
      ? "Line Maintenance"
      : "Break Slot";

  const [startTime, setStartTime] = useState(defaultStartTime);
  const [durationMins, setDurationMins] = useState(defaultDuration.toString());
  const [reason, setReason] = useState(defaultReason);

  const handleSave = () => {
    const numDur = parseInt(durationMins, 10);
    if (!startTime || isNaN(numDur) || numDur <= 0) return;

    // Auto-calculate end time from start + duration
    const [sh, sm] = startTime.split(":").map(Number);
    const totalMin = sh * 60 + sm + numDur;
    const eh = Math.floor(totalMin / 60) % 24;
    const em = totalMin % 60;
    const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;

    addBreakSlot({
      id: `break-${Date.now()}`,
      name: reason.trim() || defaultReason,
      type: category === "lunch" ? "lunch" : category === "tea" ? "tea" : category === "prayer" ? "prayer" : "other",
      unitId,
      floorId,
      startTime,
      endTime,
      durationMinutes: numDur,
    });
    onClose();
  };

  const titleText =
    category === "tea"
      ? "Add Tea Break"
      : category === "lunch"
      ? "Add Lunch Break"
      : category === "prayer"
      ? "Add Prayer Break"
      : category === "maintenance"
      ? "Add Line Maintenance Break"
      : "Add Custom Break";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-ink">{titleText}</h3>
            <p className="text-xs text-brand font-semibold">
              {unitName(unitId, lang)} · {floorName(floorId, lang)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">Break Start Time</label>
            <CustomTimePicker
              value={startTime}
              onChange={(val) => setStartTime(val)}
            />
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Break Duration (Minutes)</label>
            <input
              type="number"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              placeholder="e.g. 15, 30, 60"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink font-bold outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Break Reason / Note (Type Any Reason)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Morning Refreshment, Shift A Lunch, Friday Prayer..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink font-semibold outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!reason.trim()}
            className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm disabled:opacity-50"
          >
            Save & Fit to Timeline
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal 3: Edit Worker Salary Class
interface EditSalaryModalProps {
  entry: SalaryBankEntry;
  onClose: () => void;
}

function EditSalaryModal({ entry, onClose }: EditSalaryModalProps) {
  const currency = useApp((s) => s.settings.displayCurrency);
  const fxRates = useApp((s) => s.fxRates);
  const rate = fxRates[currency] ?? 1;
  const updateSalaryBankEntry = useApp((s) => s.updateSalaryBankEntry);

  const [monthlySalary, setMonthlySalary] = useState(
    Math.round(entry.monthlySalaryUsd * rate).toString()
  );
  const [workingDays, setWorkingDays] = useState(entry.workingDays.toString());
  const [standardHours, setStandardHours] = useState(entry.standardHours.toString());

  const handleSave = () => {
    const numSalary = parseFloat(monthlySalary);
    const numDays = parseInt(workingDays, 10);
    const numHours = parseInt(standardHours, 10);

    if (isNaN(numSalary) || isNaN(numDays) || isNaN(numHours)) return;

    updateSalaryBankEntry({
      workerClass: entry.workerClass,
      monthlySalaryUsd: numSalary / rate,
      workingDays: numDays,
      standardHours: numHours,
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-ink capitalize">Edit Salary: {entry.workerClass}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">Monthly Base Salary ({currency})</label>
            <input
              type="number"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink font-bold outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-ink mb-1">Working Days / Mo</label>
              <input
                type="number"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink mb-1">Standard Hrs / Day</label>
              <input
                type="number"
                value={standardHours}
                onChange={(e) => setStandardHours(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm"
          >
            Update Salary Rate
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal 4: Edit Threshold
interface EditThresholdModalProps {
  kpi: KpiKey;
  currentGoodMin: number;
  currentWatchMin: number;
  onClose: () => void;
}

function EditThresholdModal({ kpi, currentGoodMin, currentWatchMin, onClose }: EditThresholdModalProps) {
  const { t } = useTranslation();
  const updateThreshold = useApp((s) => s.updateThreshold);

  const [goodMin, setGoodMin] = useState(currentGoodMin.toString());
  const [watchMin, setWatchMin] = useState(currentWatchMin.toString());

  const handleSave = () => {
    const g = parseFloat(goodMin);
    const w = parseFloat(watchMin);
    if (isNaN(g) || isNaN(w)) return;
    updateThreshold(kpi, g, w);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-ink">Edit Target: {t(`kpi.${kpi}`)}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-emerald-800 mb-1">Target (Good Boundary)</label>
            <input
              type="number"
              value={goodMin}
              onChange={(e) => setGoodMin(e.target.value)}
              className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-3 py-2 text-ink font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-amber-800 mb-1">Watch (Warning Boundary)</label>
            <input
              type="number"
              value={watchMin}
              onChange={(e) => setWatchMin(e.target.value)}
              className="w-full bg-amber-50/50 border border-amber-200 rounded-xl px-3 py-2 text-ink font-bold outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm"
          >
            Save Target
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal 5: Edit Shift Base Hours
interface EditShiftModalProps {
  onClose: () => void;
}

function EditShiftModal({ onClose }: EditShiftModalProps) {
  const shift = useApp((s) => s.settings.shift);
  const updateSettings = useApp((s) => s.updateSettings);

  const [start, setStart] = useState(shift.start);
  const [end, setEnd] = useState(shift.end);

  const handleSave = () => {
    if (!start || !end) return;
    updateSettings({ shift: { ...shift, start, end } });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-bold text-base text-ink">Edit Factory Shift Hours</h3>
          <button onClick={onClose} className="p-1 rounded-full text-ink-muted hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-ink mb-1">Shift Start Time</label>
            <CustomTimePicker
              value={start}
              onChange={(val) => setStart(val)}
            />
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1">Shift End Time</label>
            <CustomTimePicker
              value={end}
              onChange={(val) => setEnd(val)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-ink-muted hover:bg-slate-100 rounded-xl">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm"
          >
            Update Shift Schedule
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Modal 6: Confirmation for Deletion
interface ConfirmDeleteModalProps {
  type: "unit" | "floor" | "line";
  name: string;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmDeleteModal({ type, name, onConfirm, onClose }: ConfirmDeleteModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 space-y-4 animate-rise text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-state-danger flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>

        <div>
          <h3 className="font-bold text-base text-ink capitalize">Delete {type}?</h3>
          <p className="text-xs text-ink-muted mt-1">
            Are you sure you want to delete <strong className="text-ink">"{name}"</strong>?
            {type === "unit" && " This will also delete all associated floors and sewing lines in this unit."}
            {type === "floor" && " This will also delete all sewing lines on this floor."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold text-ink-muted bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2 text-xs font-bold bg-state-danger text-white hover:bg-rose-700 rounded-xl shadow-sm transition flex items-center justify-center gap-1"
          >
            <Trash2 size={13} />
            <span>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ================================================================== */
/*                     Main IeSetup Component                         */
/* ================================================================== */
export default function IeSetup() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const units = useApp((s) => s.units);
  const floors = useApp((s) => s.floors);
  const lines = useApp((s) => s.lines);
  const deleteUnit = useApp((s) => s.deleteUnit);
  const deleteFloor = useApp((s) => s.deleteFloor);
  const deleteLine = useApp((s) => s.deleteLine);
  const deleteBreakSlot = useApp((s) => s.deleteBreakSlot);
  const salaryBank = useApp((s) => s.salaryBank);
  const currency = useApp((s) => s.settings.displayCurrency);
  const fxRates = useApp((s) => s.fxRates);
  const updateSettings = useApp((s) => s.updateSettings);
  const rate = fxRates[currency] ?? 1;
  const shift = useApp((s) => s.settings.shift);
  const thresholds = useApp((s) => s.settings.thresholds);
  const lineStyles = useApp((s) => s.lineStyles);

  const [activeTab, setActiveTab] = useState<"structure" | "salary" | "shift" | "currency" | "thresholds" | "downtime">("structure");

  // Hierarchical Pill Selection (Unit -> Floor, NO "All Floors")
  const [shiftSelectedUnit, setShiftSelectedUnit] = useState<string>(units[0]?.id || "u1");
  
  // Available floors for selected unit
  const unitFloors = floors.filter((f) => f.unitId === shiftSelectedUnit);
  const [shiftSelectedFloor, setShiftSelectedFloor] = useState<string>(unitFloors[0]?.id || "f1");

  // Modal Open States
  const [addModal, setAddModal] = useState<{ type: "unit" | "floor" | "line"; parentId?: string } | null>(null);
  const [editingSalary, setEditingSalary] = useState<SalaryBankEntry | null>(null);
  const [editingThreshold, setEditingThreshold] = useState<{ kpi: KpiKey; goodMin: number; watchMin: number } | null>(null);
  const [editingShift, setEditingShift] = useState(false);
  const [createBreakPillCategory, setCreateBreakPillCategory] = useState<"tea" | "lunch" | "prayer" | "maintenance" | "custom" | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{
    type: "unit" | "floor" | "line";
    id: string;
    name: string;
  } | null>(null);

  // 9-Hour Timeline definition
  const hourlyTimeSlots = [
    { start: "08:00", end: "09:00", label: "08:00 - 09:00" },
    { start: "09:00", end: "10:00", label: "09:00 - 10:00" },
    { start: "10:00", end: "11:00", label: "10:00 - 11:00" },
    { start: "11:00", end: "12:00", label: "11:00 - 12:00" },
    { start: "12:00", end: "13:00", label: "12:00 - 13:00" },
    { start: "13:00", end: "14:00", label: "13:00 - 14:00" },
    { start: "14:00", end: "15:00", label: "14:00 - 15:00" },
    { start: "15:00", end: "16:00", label: "15:00 - 16:00" },
    { start: "16:00", end: "17:00", label: "16:00 - 17:00" },
  ];

  return (
    <div className="space-y-4 animate-rise pb-24">
      {/* Compact Header */}
      <div>
        <h1 className="text-xl font-extrabold text-ink">{t("ie.setup")}</h1>
      </div>

      {/* Interactive Horizontal Scroll Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
        <button
          onClick={() => setActiveTab("structure")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold transition shrink-0 whitespace-nowrap ${
            activeTab === "structure"
              ? "bg-brand text-white shadow-md font-bold"
              : "glass-1 text-ink-muted hover:text-ink"
          }`}
        >
          <Building2 size={15} />
          <span>Factory Structure</span>
        </button>

        <button
          onClick={() => setActiveTab("salary")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold transition shrink-0 whitespace-nowrap ${
            activeTab === "salary"
              ? "bg-brand text-white shadow-md font-bold"
              : "glass-1 text-ink-muted hover:text-ink"
          }`}
        >
          <Coins size={15} />
          <span>Salary Bank</span>
        </button>

        <button
          onClick={() => setActiveTab("shift")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold transition shrink-0 whitespace-nowrap ${
            activeTab === "shift"
              ? "bg-brand text-white shadow-md font-bold"
              : "glass-1 text-ink-muted hover:text-ink"
          }`}
        >
          <Clock size={15} />
          <span>Shift & Breaks</span>
        </button>

        <button
          onClick={() => setActiveTab("currency")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold transition shrink-0 whitespace-nowrap ${
            activeTab === "currency"
              ? "bg-brand text-white shadow-md font-bold"
              : "glass-1 text-ink-muted hover:text-ink"
          }`}
        >
          <DollarSign size={15} />
          <span>Display Currency ({currency})</span>
        </button>

        <button
          onClick={() => setActiveTab("thresholds")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold transition shrink-0 whitespace-nowrap ${
            activeTab === "thresholds"
              ? "bg-brand text-white shadow-md font-bold"
              : "glass-1 text-ink-muted hover:text-ink"
          }`}
        >
          <SlidersHorizontal size={15} />
          <span>KPI Targets</span>
        </button>

        <button
          onClick={() => setActiveTab("downtime")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold transition shrink-0 whitespace-nowrap ${
            activeTab === "downtime"
              ? "bg-brand text-white shadow-md font-bold"
              : "glass-1 text-ink-muted hover:text-ink"
          }`}
        >
          <AlertTriangle size={15} />
          <span>{t("downtime.manage")}</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TAB 1: FACTORY STRUCTURE (Units, Floors & Lines)       */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "structure" && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Building2 size={16} className="text-brand" />
              <span>Factory Layout & Sewing Lines</span>
            </h2>
            <button
              onClick={() => setAddModal({ type: "unit" })}
              className="px-3 py-1.5 text-xs font-bold bg-brand text-white rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition"
            >
              <Plus size={14} />
              <span>Add Unit</span>
            </button>
          </div>

          {/* Units & Floors Mapping */}
          {units.map((u) => {
            const uFloors = floors.filter((f) => f.unitId === u.id);

            return (
              <GlassCard key={u.id} level="solid" hairline className="p-4 space-y-3 border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Building className="text-brand" size={18} />
                    <h3 className="font-bold text-base text-ink">{unitName(u.id, lang)}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAddModal({ type: "floor", parentId: u.id })}
                      className="px-2.5 py-1 text-xs font-semibold text-brand bg-brand-100 hover:bg-brand hover:text-white rounded-lg transition flex items-center gap-1"
                    >
                      <Plus size={13} />
                      <span>Add Floor</span>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTarget({ type: "unit", id: u.id, name: unitName(u.id, lang) })}
                      className="p-1 rounded-lg text-state-danger hover:bg-rose-50 transition"
                      title="Delete Unit"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {uFloors.length === 0 ? (
                    <p className="text-xs text-ink-muted italic p-2">No floors added to this unit yet.</p>
                  ) : (
                    uFloors.map((f) => {
                      const floorLines = lines.filter((l) => l.floorId === f.id);

                      return (
                        <div key={f.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink">{floorName(f.id, lang)}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setAddModal({ type: "line", parentId: f.id })}
                                className="text-[11px] text-brand font-semibold hover:underline flex items-center gap-0.5"
                              >
                                <Plus size={12} /> Add Line
                              </button>
                              <button
                                onClick={() => setConfirmDeleteTarget({ type: "floor", id: f.id, name: floorName(f.id, lang) })}
                                className="p-0.5 rounded text-state-danger hover:bg-rose-100 transition"
                                title="Delete Floor"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {floorLines.length === 0 ? (
                              <p className="text-[11px] text-ink-muted italic col-span-2">No lines on this floor.</p>
                            ) : (
                              floorLines.map((l) => {
                                const activeLs = lineStyles.find((x) => x.lineId === l.id && !x.unloadedAt);

                                return (
                                  <div
                                    key={l.id}
                                    className="bg-white p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <span className="font-bold text-ink block">{lineName(l.id, lang)}</span>
                                      {activeLs ? (
                                        <span className="text-[10px] text-emerald-700 font-semibold block">
                                          Active Style Running ✓
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-ink-muted block">No Active Style</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        ID: {l.id}
                                      </span>
                                      <button
                                        onClick={() => setConfirmDeleteTarget({ type: "line", id: l.id, name: lineName(l.id, lang) })}
                                        className="p-1 rounded text-state-danger hover:bg-rose-100 transition"
                                        title="Delete Line"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TAB 2: SALARY BANK EDITING                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "salary" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <Coins size={16} className="text-brand" />
                <span>Worker Salary Bank & Rate Configuration</span>
              </h2>
              <p className="text-[11px] text-ink-muted">Tap edit to adjust base worker salaries or working days</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {salaryBank.map((s) => {
              const monthlyInCurr = s.monthlySalaryUsd * rate;
              const dailyRate = monthlyInCurr / s.workingDays;
              const hourlyRate = dailyRate / s.standardHours;
              const minRate = hourlyRate / 60;

              return (
                <GlassCard key={s.workerClass} level="solid" hairline className="p-4 space-y-3 border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-sm text-ink capitalize">{s.workerClass}</span>
                    <button
                      onClick={() => setEditingSalary(s)}
                      className="px-2.5 py-1 text-xs font-semibold text-brand bg-brand-100 hover:bg-brand hover:text-white rounded-lg transition flex items-center gap-1"
                    >
                      <Edit2 size={12} />
                      <span>Edit Values</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-ink-muted">Monthly Base Salary:</span>
                      <span className="font-extrabold text-brand text-sm">{money(monthlyInCurr, currency)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center bg-white p-2 rounded-xl border border-slate-200/80 text-[10px]">
                      <div>
                        <span className="text-ink-muted block">Daily ({s.workingDays}d)</span>
                        <span className="font-bold text-ink">{money(dailyRate, currency, 1)}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">Hourly ({s.standardHours}h)</span>
                        <span className="font-bold text-ink">{money(hourlyRate, currency, 1)}</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">Per Minute</span>
                        <span className="font-bold text-emerald-700">{money(minRate, currency, 2)}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TAB 3: SHIFT SCHEDULE & HIERARCHICAL BREAK TIMELINE    */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "shift" && (
        <div className="space-y-4">
          <GlassCard level="solid" hairline className="p-4 space-y-4 border border-slate-200">
            {/* 1. SHIFT START & END TIME AT TOP */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                  Factory Shift Working Hours
                </span>
                <h2 className="font-extrabold text-lg text-ink flex items-center gap-2">
                  <Clock size={20} className="text-brand" />
                  <span>{shift.start} — {shift.end}</span>
                </h2>
              </div>
              <button
                onClick={() => setEditingShift(true)}
                className="px-3 py-1.5 text-xs font-bold text-brand bg-brand-100 hover:bg-brand hover:text-white rounded-xl transition flex items-center gap-1 shadow-sm"
              >
                <Edit2 size={13} />
                <span>Edit Shift Hours</span>
              </button>
            </div>

            {/* 2. LEVEL 1 PILLS: UNIT SELECTOR */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                1. Select Unit:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
                {units.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setShiftSelectedUnit(u.id);
                      const f = floors.find((x) => x.unitId === u.id);
                      if (f) setShiftSelectedFloor(f.id);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl font-bold transition shrink-0 ${
                      shiftSelectedUnit === u.id
                        ? "bg-brand text-white shadow-md scale-[1.02]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Building2 size={15} />
                    <span>{unitName(u.id, lang)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. LEVEL 2 PILLS: FLOORS IN SELECTED UNIT (NO "ALL FLOORS") */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                2. Select Floor in {unitName(shiftSelectedUnit, lang)}:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
                {unitFloors.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setShiftSelectedFloor(f.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 ${
                      shiftSelectedFloor === f.id
                        ? "bg-brand-100 text-brand font-extrabold border-2 border-brand shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Layers size={13} />
                    <span>{floorName(f.id, lang)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. PILLS OF BREAK CATEGORIES TO ADD QUICKLY */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-amber-600" />
                Add Break Slot to Timeline:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                <button
                  onClick={() => setCreateBreakPillCategory("tea")}
                  className="px-3 py-1.5 rounded-xl font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <Coffee size={14} /> Tea Break
                </button>
                <button
                  onClick={() => setCreateBreakPillCategory("lunch")}
                  className="px-3 py-1.5 rounded-xl font-bold bg-brand-100 text-brand border border-brand/30 hover:bg-brand-200 transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <Utensils size={14} /> Lunch Break
                </button>
                <button
                  onClick={() => setCreateBreakPillCategory("prayer")}
                  className="px-3 py-1.5 rounded-xl font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <Building size={14} /> Prayer Break
                </button>
                <button
                  onClick={() => setCreateBreakPillCategory("maintenance")}
                  className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200 transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <Clock size={14} /> Maintenance
                </button>
                <button
                  onClick={() => setCreateBreakPillCategory("custom")}
                  className="px-3 py-1.5 rounded-xl font-bold bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200 transition shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} /> Custom Break
                </button>
              </div>
            </div>
          </GlassCard>

          {/* 5. GENERATED AUTO TIMELINE VIEW */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-brand" />
                <span>Operating Timeline: {unitName(shiftSelectedUnit, lang)} · {floorName(shiftSelectedFloor, lang)}</span>
              </h3>
            </div>

            {hourlyTimeSlots.map((slot) => {
              // Find breaks matching active unit & floor in this slot
              const slotBreaks = (shift.breaks || []).filter((b) => {
                const matchesUnit = !b.unitId || b.unitId === "all" || b.unitId === shiftSelectedUnit;
                const matchesFloor = !b.floorId || b.floorId === "all" || b.floorId === shiftSelectedFloor;
                if (!matchesUnit || !matchesFloor) return false;

                const [bH] = b.startTime.split(":").map(Number);
                const [sH] = slot.start.split(":").map(Number);
                return bH === sH;
              });

              return (
                <GlassCard
                  key={slot.label}
                  level="solid"
                  hairline
                  className={`p-3.5 border rounded-2xl space-y-2 text-xs transition ${
                    slotBreaks.length > 0
                      ? slotBreaks.some((x) => x.type === "lunch")
                        ? "bg-amber-50/90 border-amber-300 shadow-sm"
                        : "bg-orange-50/80 border-amber-200 shadow-sm"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-brand bg-brand-100 border border-brand/20 px-3 py-1 rounded-xl text-xs">
                      Slot: {slot.label}
                    </span>

                    {slotBreaks.length === 0 ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        Production Work (60 mins)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-200 px-2.5 py-0.5 rounded-full">
                        Break Inserted ({slotBreaks.reduce((a, b) => a + b.durationMinutes, 0)} mins)
                      </span>
                    )}
                  </div>

                  {slotBreaks.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {slotBreaks.map((brk) => (
                        <div
                          key={brk.id}
                          className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {brk.type === "lunch" ? (
                              <Utensils size={15} className="text-amber-800 shrink-0" />
                            ) : (
                              <Coffee size={15} className="text-amber-700 shrink-0" />
                            )}
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">{brk.name}</span>
                              <span className="text-[10px] text-ink-muted block font-medium">
                                Time: <strong className="text-brand font-semibold">{brk.startTime} - {brk.endTime}</strong> ({brk.durationMinutes} mins break)
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => deleteBreakSlot(brk.id)}
                            className="p-1 rounded-lg text-state-danger hover:bg-rose-50 transition"
                            title="Remove Break"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TAB 4: DISPLAY CURRENCY SELECTOR                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "currency" && (
        <div className="space-y-4">
          <GlassCard level="solid" hairline className="p-4 space-y-3 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-brand" />
                <h2 className="font-bold text-base text-ink">{t("ie.displayCurrency")}</h2>
              </div>
              <span className="text-xs font-bold text-brand bg-brand-100 px-2.5 py-0.5 rounded-full">
                Active: {currency}
              </span>
            </div>

            <p className="text-xs text-ink-muted">
              Select the primary display currency across all factory dashboards and financial reports:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => updateSettings({ displayCurrency: "BDT" })}
                className={`p-4 rounded-2xl border text-left transition relative overflow-hidden ${
                  currency === "BDT"
                    ? "bg-brand text-white border-brand shadow-md"
                    : "bg-slate-50 border-slate-200 text-ink hover:bg-slate-100"
                }`}
              >
                {currency === "BDT" && (
                  <CheckCircle2 size={16} className="absolute right-3 top-3 text-white" />
                )}
                <span className="font-extrabold text-xl block">৳ BDT</span>
                <span className="text-xs opacity-90 block mt-1">Bangladeshi Taka</span>
                <span className="text-[10px] opacity-75 block mt-2 font-medium">1 USD = 119.5 BDT</span>
              </button>

              <button
                onClick={() => updateSettings({ displayCurrency: "INR" })}
                className={`p-4 rounded-2xl border text-left transition relative overflow-hidden ${
                  currency === "INR"
                    ? "bg-brand text-white border-brand shadow-md"
                    : "bg-slate-50 border-slate-200 text-ink hover:bg-slate-100"
                }`}
              >
                {currency === "INR" && (
                  <CheckCircle2 size={16} className="absolute right-3 top-3 text-white" />
                )}
                <span className="font-extrabold text-xl block">₹ INR</span>
                <span className="text-xs opacity-90 block mt-1">Indian Rupee</span>
                <span className="text-[10px] opacity-75 block mt-2 font-medium">1 USD = 83.2 INR</span>
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TAB 5: KPI TARGET THRESHOLDS                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "thresholds" && (
        <div className="space-y-4">
          <GlassCard level="solid" hairline className="p-4 space-y-3 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-brand" />
                <h2 className="font-bold text-base text-ink">Operational Target Thresholds</h2>
              </div>
              <span className="text-xs text-ink-muted font-medium">Click edit icon to modify boundaries</span>
            </div>

            <div className="space-y-2">
              {thresholds.map((th) => {
                const label = t(`kpi.${th.kpi}`);
                return (
                  <div key={th.kpi} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-ink block">{label}</span>
                      <span className="text-[10px] text-ink-muted capitalize">
                        {th.direction === "higher_is_better" ? "Higher is better (↑)" : "Lower is better (↓)"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        🟢 Target: {th.goodMin}
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        🟠 Watch: {th.watchMin}
                      </span>

                      <button
                        onClick={() =>
                          setEditingThreshold({
                            kpi: th.kpi,
                            goodMin: th.goodMin,
                            watchMin: th.watchMin,
                          })
                        }
                        className="p-1 rounded-lg text-ink-muted hover:text-brand hover:bg-slate-200 transition"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  TAB 6: DOWNTIME REASONS MANAGEMENT                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "downtime" && (
        <DowntimeReasonsInline />
      )}

      {/* Render Modals */}
      {addModal && (
        <AddEntityModal
          type={addModal.type}
          parentId={addModal.parentId}
          onClose={() => setAddModal(null)}
        />
      )}

      {createBreakPillCategory && (
        <CreateBreakFromPillModal
          category={createBreakPillCategory}
          unitId={shiftSelectedUnit}
          floorId={shiftSelectedFloor}
          onClose={() => setCreateBreakPillCategory(null)}
        />
      )}

      {editingSalary && (
        <EditSalaryModal
          entry={editingSalary}
          onClose={() => setEditingSalary(null)}
        />
      )}

      {editingThreshold && (
        <EditThresholdModal
          kpi={editingThreshold.kpi}
          currentGoodMin={editingThreshold.goodMin}
          currentWatchMin={editingThreshold.watchMin}
          onClose={() => setEditingThreshold(null)}
        />
      )}

      {editingShift && <EditShiftModal onClose={() => setEditingShift(false)} />}

      {confirmDeleteTarget && (
        <ConfirmDeleteModal
          type={confirmDeleteTarget.type}
          name={confirmDeleteTarget.name}
          onConfirm={() => {
            if (confirmDeleteTarget.type === "unit") deleteUnit(confirmDeleteTarget.id);
            else if (confirmDeleteTarget.type === "floor") deleteFloor(confirmDeleteTarget.id);
            else if (confirmDeleteTarget.type === "line") deleteLine(confirmDeleteTarget.id);
          }}
          onClose={() => setConfirmDeleteTarget(null)}
        />
      )}
    </div>
  );
}
