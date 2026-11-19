// Kalkulator lot: daftar instrumen & rumus sama dengan web (lib/lot-instruments.ts, components/calculator/LotCalculator.tsx).

export type InstrumentType = "Forex" | "Commodity" | "Index" | "Crypto" | "Custom";
export type MarginBasis = "quote" | "base";

export interface Instrument {
  symbol: string;
  type: InstrumentType;
  pipSize: number;
  contractSize: number;
  quoteIsUSD: boolean;
  marginBasis: MarginBasis;
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: "EURUSD", type: "Forex", pipSize: 0.0001, contractSize: 100_000, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "GBPUSD", type: "Forex", pipSize: 0.0001, contractSize: 100_000, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "AUDUSD", type: "Forex", pipSize: 0.0001, contractSize: 100_000, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "NZDUSD", type: "Forex", pipSize: 0.0001, contractSize: 100_000, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "USDJPY", type: "Forex", pipSize: 0.01, contractSize: 100_000, quoteIsUSD: false, marginBasis: "base" },
  { symbol: "USDCHF", type: "Forex", pipSize: 0.0001, contractSize: 100_000, quoteIsUSD: false, marginBasis: "base" },
  { symbol: "USDCAD", type: "Forex", pipSize: 0.0001, contractSize: 100_000, quoteIsUSD: false, marginBasis: "base" },
  { symbol: "XAUUSD", type: "Commodity", pipSize: 0.1, contractSize: 100, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "XAGUSD", type: "Commodity", pipSize: 0.001, contractSize: 5_000, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "US30", type: "Index", pipSize: 1, contractSize: 1, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "NAS100", type: "Index", pipSize: 1, contractSize: 1, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "BTCUSD", type: "Crypto", pipSize: 1, contractSize: 1, quoteIsUSD: true, marginBasis: "quote" },
  { symbol: "CUSTOM", type: "Custom", pipSize: 0.0001, contractSize: 0, quoteIsUSD: true, marginBasis: "quote" },
];

export interface LotInput {
  instrument: Instrument;
  direction: "LONG" | "SHORT";
  balance: number;
  riskPercent: number;
  leverage: number;
  entry: number;
  slMode: "PRICE" | "PIPS";
  slValue: number;
  tpMode: "PRICE" | "PIPS" | "RR";
  tpValue: number;
  customPipSize: number;
  customPipValue: number;
  customContractSize: number;
}

export interface LotResult {
  pipValuePerLot: number | null;
  slPips: number;
  slPrice: number;
  slOnWrongSide: boolean;
  tpPips: number | null;
  tpPrice: number | null;
  riskAmount: number;
  lotSize: number | null;
  rr: number | null;
  potentialProfit: number | null;
  estMargin: number | null;
}

export function computeLot(i: LotInput): LotResult | null {
  const { instrument, direction } = i;
  const isCustom = instrument.type === "Custom";
  const b = i.balance;
  const r = i.riskPercent;
  const e = i.entry;
  const pipSize = isCustom ? i.customPipSize : instrument.pipSize;
  if (!b || b <= 0 || !r || r <= 0 || !pipSize || pipSize <= 0) return null;

  // Nilai 1 pip per 1.0 lot standar (USD)
  let pipValuePerLot: number | null;
  if (isCustom) pipValuePerLot = i.customPipValue || null;
  else if (instrument.quoteIsUSD) pipValuePerLot = pipSize * instrument.contractSize;
  else pipValuePerLot = e > 0 ? (pipSize * instrument.contractSize) / e : null;

  const slRaw = i.slValue;
  if (!slRaw || slRaw <= 0 || !e) return null;
  let slPips: number;
  let slPrice: number;
  if (i.slMode === "PIPS") {
    slPips = slRaw;
    slPrice = direction === "LONG" ? e - slPips * pipSize : e + slPips * pipSize;
  } else {
    slPrice = slRaw;
    slPips = Math.abs(direction === "LONG" ? (e - slPrice) / pipSize : (slPrice - e) / pipSize);
  }
  if (!slPips) return null;
  const slOnWrongSide = (direction === "LONG" && slPrice >= e) || (direction === "SHORT" && slPrice <= e);

  let tpPips: number | null = null;
  let tpPrice: number | null = null;
  const tpRaw = i.tpValue;
  if (tpRaw && tpRaw > 0) {
    if (i.tpMode === "PIPS") {
      tpPips = tpRaw;
      tpPrice = direction === "LONG" ? e + tpPips * pipSize : e - tpPips * pipSize;
    } else if (i.tpMode === "PRICE") {
      tpPrice = tpRaw;
      tpPips = Math.abs(direction === "LONG" ? (tpPrice - e) / pipSize : (e - tpPrice) / pipSize);
    } else {
      tpPips = slPips * tpRaw;
      tpPrice = direction === "LONG" ? e + tpPips * pipSize : e - tpPips * pipSize;
    }
  }

  const riskAmount = b * (r / 100);
  const lotSize = pipValuePerLot ? riskAmount / (slPips * pipValuePerLot) : null;
  const rr = tpPips ? tpPips / slPips : null;
  const potentialProfit = lotSize && tpPips && pipValuePerLot ? lotSize * tpPips * pipValuePerLot : null;
  const contractSize = isCustom ? i.customContractSize || null : instrument.contractSize;
  let estMargin: number | null = null;
  if (lotSize && contractSize && i.leverage > 0) {
    const notional = instrument.marginBasis === "quote" ? lotSize * contractSize * e : lotSize * contractSize;
    estMargin = notional / i.leverage;
  }
  return { pipValuePerLot, slPips, slPrice, slOnWrongSide, tpPips, tpPrice, riskAmount, lotSize, rr, potentialProfit, estMargin };
}

export function riskLabel(percent: number): { label: string; tone: "success" | "warning" | "error" } {
  if (percent <= 0.5) return { label: "Sangat Konservatif", tone: "success" };
  if (percent <= 1) return { label: "Konservatif", tone: "success" };
  if (percent <= 2) return { label: "Moderat", tone: "warning" };
  if (percent <= 3) return { label: "Agresif", tone: "error" };
  return { label: "Sangat Agresif", tone: "error" };
}

/** Cocokkan simbol sinyal ke instrumen kalkulator (mis. "XAUUSD.m" → XAUUSD). */
export function findInstrument(symbol: string | undefined): Instrument | null {
  if (!symbol) return null;
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return INSTRUMENTS.find((i) => i.symbol !== "CUSTOM" && s.startsWith(i.symbol)) ?? null;
}
