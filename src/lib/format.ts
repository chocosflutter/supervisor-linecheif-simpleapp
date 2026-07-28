import type { Currency } from "@/types";
import { useApp } from "@/store/appStore";

const SYMBOL: Record<Currency, string> = {
  INR: "₹",
  BDT: "৳",
};

/** Get the current FX rate for a currency (from store; fallback to 1). */
function getRate(currency: Currency): number {
  const s = useApp.getState();
  // fxRates in the store is Record<string, number> keyed by currency code.
  return s.fxRates?.[currency] ?? 1;
}

/** Convert a USD amount to the display currency. */
export function usdToDisplay(usd: number, currency: Currency): number {
  return usd * getRate(currency);
}

/** Format a USD value as a money string in the display currency. */
export function money(usd: number, currency: Currency, digits = 0): string {
  const v = usdToDisplay(usd, currency);
  return `${SYMBOL[currency]}${v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function num(v: number, digits = 0): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(v: number, digits = 1): string {
  return `${v.toFixed(digits)}%`;
}
