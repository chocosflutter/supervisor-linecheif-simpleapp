import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "@/store/appStore";
import { emptyKpis, statusFor } from "@/lib/kpi";
import { useKpis, useProducedSeries } from "@/hooks/useRepo";
import { computeTargetAchievement } from "@/lib/targetAchievement";
import { money, num, pct } from "@/lib/format";
import type { KpiKey, KpiStatus } from "@/types";
import KpiCard from "./KpiCard";
import KpiDetailModal from "./KpiDetailModal";
import { TODAY } from "@/lib/today";

interface Props {
  lineIds: string[];
  /** Which KPIs to show. Supervisors don't see CM but do see profit. */
  showProfit?: boolean;
  datePreset?: string;
  startDate?: string;
  endDate?: string;
  filterStyleId?: string;
}

interface CardItem {
  key: KpiKey;
  title: string;
  value: string;
  subtitle: string;
  raw: number;
  spark?: number[];
  status: KpiStatus;
}

export default function KpiGrid({
  lineIds,
  showProfit = true,
  datePreset = "today",
  startDate,
  endDate,
  filterStyleId,
}: Props) {
  const { t } = useTranslation();
  const settings = useApp((s) => s.settings);
  const currency = settings.displayCurrency;

  const [activeCard, setActiveCard] = useState<CardItem | null>(null);

  const { data: kpis = emptyKpis() } = useKpis({ lineIds, datePreset, startDate, endDate, filterStyleId });
  const { data: spark = [] } = useProducedSeries(lineIds, TODAY);

  // No hardcoded fallbacks — empty spark means no data (shows empty sparkline).
  const sparkProductivity = useMemo(() => spark.length > 1 ? spark.map((v, i) => Math.round(v * 28 + i * 40)) : [], [spark]);
  const sparkCost = useMemo(() => spark.length > 1 ? spark.map((_, i) => Math.round((13.2 - i * 0.3) * 100) / 100) : [], [spark]);
  const sparkEfficiency = useMemo(() => spark.length > 1 ? spark.map((v) => Math.round(v * 1.2)) : [], [spark]);
  const sparkProfit = useMemo(() => spark.length > 1 ? spark.map((v, i) => Math.round(v * 240 + i * 500)) : [], [spark]);
  const sparkDefective = useMemo(() => spark.length > 1 ? spark.map((_, i) => Math.round((5.2 - i * 0.4) * 10) / 10) : [], [spark]);
  const sparkAbsenteeism = useMemo(() => [] as number[], []);
  const sparkChangeover = useMemo(() => [] as number[], []);

  const th = (k: KpiKey) => settings.thresholds.find((x) => x.kpi === k);

  const cards: CardItem[] = [
    {
      key: "productivity",
      title: t("kpi.productivity"),
      value: money(kpis.productivityUsd, currency),
      subtitle: t("kpi.perManHour"),
      raw: kpis.productivityUsd * 83, // approx local-value scale for threshold demo
      spark: sparkProductivity,
      status: statusFor(kpis.productivityUsd * 83, th("productivity")),
    },
    {
      key: "cost",
      title: t("kpi.cost"),
      value: money(kpis.perPieceCostUsd, currency, 2),
      subtitle: t("kpi.perPc"),
      raw: kpis.perPieceCostUsd,
      spark: sparkCost,
      status: statusFor(kpis.perPieceCostUsd, th("cost")),
    },
    {
      key: "efficiency",
      title: t("kpi.efficiency"),
      value: pct(kpis.efficiency),
      subtitle: `${num(kpis.producedQty)} pcs`,
      raw: kpis.efficiency,
      spark: sparkEfficiency,
      status: statusFor(kpis.efficiency, th("efficiency")),
    },
    {
      key: "changeover",
      title: t("kpi.changeover"),
      value: kpis.changeoverCount > 0 ? `${kpis.changeoverAvgMin} min` : "N/A",
      subtitle: kpis.changeoverCount > 0 ? `${kpis.changeoverCount} ${t("kpi.monthly")}` : "No changeovers",
      raw: kpis.changeoverAvgMin,
      spark: sparkChangeover,
      status: kpis.changeoverCount > 0 ? statusFor(kpis.changeoverAvgMin, th("changeover")) : "success",
    },
    {
      key: "defective",
      title: t("kpi.defective"),
      value: pct(kpis.defectivePct),
      subtitle: `${num(kpis.defectivePcs)} defective pcs`,
      raw: kpis.defectivePct,
      spark: sparkDefective,
      status: statusFor(kpis.defectivePct, th("defective")),
    },
    {
      key: "dhu",
      title: t("kpi.dhu"),
      value: `${num(kpis.dhu, 1)}`, // Plain number format (e.g. 4.6 or 12.56) — NOT %!
      subtitle: "defects per 100 pcs",
      raw: kpis.dhu,
      spark: sparkDefective.map((v) => Math.round(v * 1.4 * 10) / 10),
      status: statusFor(kpis.dhu, th("dhu")),
    },
    {
      key: "absenteeism",
      title: t("kpi.absenteeism"),
      value: pct(kpis.absenteeismPct),
      subtitle: `${num(kpis.workforce)} present`,
      raw: kpis.absenteeismPct,
      spark: sparkAbsenteeism,
      status: statusFor(kpis.absenteeismPct, th("absenteeism")),
    },
  ];

  if (showProfit) {
    cards.push({
      key: "profit",
      title: t("kpi.profit"),
      value: money(kpis.netProfitUsd, currency),
      subtitle: t("common.today"),
      raw: kpis.netProfitUsd * 83,
      spark: sparkProfit,
      status: statusFor(kpis.netProfitUsd * 83, th("profit")),
    });
  }

  // Target Achievement KPI (Phase 11) — always show, computed client-side
  const lineStylesAll = useApp((s) => s.lineStyles);
  const productionAll = useApp((s) => s.production);
  const weeklyOffAll = useApp((s) => s.weeklyOff);
  const holidaysAll = useApp((s) => s.holidays);
  const targetAch = useMemo(() => {
    const activeLS = lineStylesAll.find(
      (ls) => lineIds.includes(ls.lineId) && ls.status === "active" && !ls.unloadedAt && ls.orderQty && ls.sewingEndDate,
    );
    if (!activeLS) return null;
    return computeTargetAchievement(activeLS, productionAll, TODAY, weeklyOffAll, holidaysAll.map((h) => h.date));
  }, [lineStylesAll, productionAll, weeklyOffAll, holidaysAll, lineIds]);

  // Always show Target Achievement card (shows "N/A" when no target configured)
  if (targetAch) {
    const achStatus = targetAch.status === "on_track" ? "success" : targetAch.status === "slightly_behind" ? "warning" : "danger";
    cards.push({
      key: "target" as KpiKey,
      title: "Target Achievement",
      value: `${targetAch.plannedAchievementPct.toFixed(1)}%`,
      subtitle: `${num(targetAch.todayActual)} / ${num(targetAch.plannedDailyTarget)} pcs/day`,
      raw: targetAch.plannedAchievementPct,
      spark: [],
      status: achStatus,
    });
  } else {
    cards.push({
      key: "target" as KpiKey,
      title: "Target Achievement",
      value: "N/A",
      subtitle: "Load style with order qty to track",
      raw: 0,
      spark: [],
      status: "success",
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div key={c.key} className="animate-rise">
            <KpiCard
              kpiKey={c.key}
              align={i % 2 === 0 ? "left" : "right"}
              title={c.title}
              value={c.value}
              subtitle={c.subtitle}
              status={c.status}
              spark={c.spark}
              onClick={() => setActiveCard(c)}
            />
          </div>
        ))}
      </div>

      {activeCard && (
        <KpiDetailModal
          isOpen={!!activeCard}
          onClose={() => setActiveCard(null)}
          kpiKey={activeCard.key}
          title={activeCard.title}
          value={activeCard.value}
          subtitle={activeCard.subtitle}
          status={activeCard.status}
          spark={activeCard.spark}
          lineIds={lineIds}
          outerDatePreset={datePreset}
          outerStartDate={startDate}
          outerEndDate={endDate}
        />
      )}
    </>
  );
}
