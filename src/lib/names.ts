import type { Lang } from "@/types";
import { useApp } from "@/store/appStore";

interface Named {
  name_en: string;
  name_bn: string;
}

export function localName(n: Named | undefined, lang: Lang): string {
  if (!n) return "";
  return lang === "bn" ? n.name_bn : n.name_en;
}

export const lineName = (id: string, lang: Lang) =>
  localName(useApp.getState().lines.find((l) => l.id === id), lang);
export const floorName = (id: string, lang: Lang) =>
  localName(useApp.getState().floors.find((f) => f.id === id), lang);
export const unitName = (id: string, lang: Lang) =>
  localName(useApp.getState().units.find((u) => u.id === id), lang);
