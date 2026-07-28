/** Resolve a KPI date preset (or explicit range) into concrete start/end ISO dates. */
export function resolveDateRange(
  preset: string = "today",
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayStr = iso(today);

  switch (preset) {
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: iso(y), end: iso(y) };
    }
    case "last7": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: iso(s), end: todayStr };
    }
    case "last30": {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: iso(s), end: todayStr };
    }
    case "custom":
      return { start: startDate || todayStr, end: endDate || todayStr };
    case "today":
    default:
      // Also handles an explicit ISO date passed as the preset.
      if (/^\d{4}-\d{2}-\d{2}$/.test(preset)) return { start: preset, end: preset };
      return { start: todayStr, end: todayStr };
  }
}
