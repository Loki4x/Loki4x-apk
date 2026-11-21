import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { computeLot, findInstrument, INSTRUMENTS, riskLabel } from "@/shared/lot-calc";

const PREFS_KEY = "loki4x-lot-prefs";
const QUICK_BALANCES = [100, 500, 1_000, 5_000, 10_000];
const RISK_LEVELS = ["0.5", "1", "2", "3"];
const LEVERAGES = ["50", "100", "200", "500"];

const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const fixed = Math.abs(n).toFixed(digits);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

/**
 * Lot Calculator (sama dengan web). Bisa dibuka dari detail sinyal:
 * /calculator?symbol=XAUUSD&dir=SHORT&entry=..&sl=..&tp=..
 */
export default function CalculatorScreen() {
  const params = useLocalSearchParams<{ symbol?: string; dir?: string; entry?: string; sl?: string; tp?: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const fromSignal = !!params.entry;
  const [symbol, setSymbol] = useState(findInstrument(params.symbol)?.symbol ?? (params.symbol ? "CUSTOM" : "XAUUSD"));
  const [direction, setDirection] = useState<"LONG" | "SHORT">(params.dir === "BUY" || params.dir === "LONG" ? "LONG" : "SHORT");
  const [balance, setBalance] = useState("1000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [leverage, setLeverage] = useState("100");
  const [entry, setEntry] = useState(params.entry ?? "");
  const [slMode, setSlMode] = useState<"PRICE" | "PIPS">(fromSignal ? "PRICE" : "PIPS");
  const [slValue, setSlValue] = useState(params.sl ?? "20");
  const [tpMode, setTpMode] = useState<"PRICE" | "PIPS" | "RR">(fromSignal ? "PRICE" : "RR");
  const [tpValue, setTpValue] = useState(fromSignal ? params.tp ?? "" : "2");
  const [customPipSize, setCustomPipSize] = useState("0.0001");
  const [customPipValue, setCustomPipValue] = useState("10");
  const [customContract, setCustomContract] = useState("");
  const [copied, setCopied] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Saldo, risiko, dan leverage terakhir diingat di HP ini.
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved === "object") {
          if (typeof saved.balance === "string") setBalance(saved.balance);
          if (typeof saved.riskPercent === "string") setRiskPercent(saved.riskPercent);
          if (typeof saved.leverage === "string") setLeverage(saved.leverage);
        }
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true));
  }, []);
  useEffect(() => {
    if (prefsLoaded) AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ balance, riskPercent, leverage })).catch(() => {});
  }, [balance, riskPercent, leverage, prefsLoaded]);

  const instrument = INSTRUMENTS.find((i) => i.symbol === symbol) ?? INSTRUMENTS[0];
  const isCustom = instrument.type === "Custom";
  const calc = useMemo(
    () =>
      computeLot({
        instrument,
        direction,
        balance: num(balance),
        riskPercent: num(riskPercent),
        leverage: num(leverage),
        entry: num(entry),
        slMode,
        slValue: num(slValue),
        tpMode,
        tpValue: num(tpValue),
        customPipSize: num(customPipSize),
        customPipValue: num(customPipValue),
        customContractSize: num(customContract),
      }),
    [instrument, direction, balance, riskPercent, leverage, entry, slMode, slValue, tpMode, tpValue, customPipSize, customPipValue, customContract]
  );

  if (!session) return <Redirect href="/login" />;
  if (!hasAccess(profile?.effectiveTier, "MEMBERSHIP")) {
    return (
      <Screen>
        <BackHeader title="Lot Calculator" />
        <Card style={{ borderColor: colors.primary }}>
          <T variant="h3">Khusus Membership 🔒</T>
          <T variant="bodySm" color="textSecondary">Hitung ukuran lot berdasarkan manajemen risiko kamu.</T>
          <Button title="Upgrade sekarang" onPress={() => router.push("/upgrade")} />
        </Card>
      </Screen>
    );
  }

  const risk = riskLabel(num(riskPercent));
  const decimals = instrument.pipSize < 0.01 ? 5 : instrument.pipSize < 1 ? 3 : 2;

  return (
    <Screen>
      <BackHeader title="Lot Calculator" />
      <T variant="bodySm" color="textSecondary">Hitung ukuran lot berdasarkan manajemen risiko kamu.</T>

      {/* Hasil di atas supaya langsung terlihat */}
      <Card style={{ borderColor: colors.primary }}>
        <T variant="label" color="textMuted">Position Size</T>
        <View style={styles.between}>
          <T variant="h1" color="primary">{calc?.lotSize ? calc.lotSize.toFixed(2) : "—"} <T variant="body" color="textMuted">lot</T></T>
          {calc?.lotSize ? (
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(calc.lotSize!.toFixed(2));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              style={[styles.copy, { borderColor: colors.border }]}
            >
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={copied ? colors.success : colors.text} />
              <T variant="caption">{copied ? "Tersalin!" : "Copy"}</T>
            </Pressable>
          ) : null}
        </View>
        {calc?.lotSize ? (
          <T variant="caption" color="textMuted">
            Mini {fmt(calc.lotSize * 10)} · Micro {fmt(calc.lotSize * 100)}
          </T>
        ) : null}
        <View style={styles.grid}>
          {[
            { label: "Risk Exposure", value: `$${fmt(calc?.riskAmount)}`, color: colors.error },
            { label: "Potensi profit", value: calc?.potentialProfit ? `$${fmt(calc.potentialProfit)}` : "—", color: colors.success },
            { label: "Risk : Reward", value: calc?.rr ? `1 : ${calc.rr.toFixed(2)}` : "—", color: colors.text },
            { label: "Pip Value / lot ($)", value: fmt(calc?.pipValuePerLot), color: colors.text },
            { label: "SL (pips)", value: fmt(calc?.slPips, 1), color: colors.text },
            { label: "Estimasi margin", value: calc?.estMargin ? `$${fmt(calc.estMargin)}` : "—", color: colors.text },
          ].map((k) => (
            <View key={k.label} style={styles.cell}>
              <T variant="caption" color="textMuted">{k.label}</T>
              <T variant="bodySm" style={{ fontWeight: "700", color: k.color }}>{k.value}</T>
            </View>
          ))}
        </View>
        {calc && (
          <T variant="caption" color="textMuted">
            Entry {fmt(num(entry), decimals)} · SL {fmt(calc.slPrice, decimals)}
            {calc.tpPrice !== null ? ` · TP ${fmt(calc.tpPrice, decimals)}` : ""}
          </T>
        )}
        {calc?.slOnWrongSide && (
          <T variant="bodySm" color="error">{t("⚠ SL ada di sisi yang salah untuk posisi {dir}.", { dir: direction })}</T>
        )}
        {!calc && <T variant="caption" color="textMuted">Isi saldo, risiko, harga entry, dan stop loss untuk melihat hasil.</T>}
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="bodySm" color="textSecondary">Instrument</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {INSTRUMENTS.map((i) => {
            const active = i.symbol === symbol;
            return (
              <Pressable
                key={i.symbol}
                onPress={() => setSymbol(i.symbol)}
                style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySubtle : colors.surface2 }]}
              >
                <T variant="bodySm" style={{ fontWeight: "600", color: active ? colors.primary : colors.textSecondary }}>
                  {i.symbol === "CUSTOM" ? "Custom" : i.symbol}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
        {!isCustom ? (
          <T variant="caption" color="textMuted">Pip: {instrument.pipSize} · {instrument.type}</T>
        ) : (
          <View style={styles.row}>
            <Field label="Pip Size" value={customPipSize} onChangeText={setCustomPipSize} keyboardType="decimal-pad" />
            <Field label="Pip Value / lot ($)" value={customPipValue} onChangeText={setCustomPipValue} keyboardType="decimal-pad" />
          </View>
        )}
        {isCustom && <Field label="Contract Size (opsional)" value={customContract} onChangeText={setCustomContract} keyboardType="decimal-pad" hint="buat estimasi margin" />}
        <OptionChips label="Direction" options={[{ value: "LONG", label: "LONG (Buy)" }, { value: "SHORT", label: "SHORT (Sell)" }]} value={direction} onChange={setDirection} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Field label="Balance ($)" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" />
        <View style={styles.quick}>
          {QUICK_BALANCES.map((b) => (
            <Pressable key={b} onPress={() => setBalance(String(b))} style={[styles.pill, { borderColor: colors.border }]}>
              <T variant="caption" color="textSecondary">${fmt(b, 0)}</T>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <Field label="Risk (%)" value={riskPercent} onChangeText={setRiskPercent} keyboardType="decimal-pad" />
          <Field label="Leverage" value={leverage} onChangeText={setLeverage} keyboardType="number-pad" />
        </View>
        <View style={styles.quick}>
          {RISK_LEVELS.map((r) => (
            <Pressable key={r} onPress={() => setRiskPercent(r)} style={[styles.pill, { borderColor: riskPercent === r ? colors.primary : colors.border }]}>
              <T variant="caption" color={riskPercent === r ? "primary" : "textSecondary"}>{r}%</T>
            </Pressable>
          ))}
          <View style={{ width: 8 }} />
          {LEVERAGES.map((l) => (
            <Pressable key={l} onPress={() => setLeverage(l)} style={[styles.pill, { borderColor: leverage === l ? colors.primary : colors.border }]}>
              <T variant="caption" color={leverage === l ? "primary" : "textSecondary"}>1:{l}</T>
            </Pressable>
          ))}
        </View>
        <View style={styles.between}>
          <T variant="caption" color="textMuted">Risk Level</T>
          <Badge label={risk.label} tone={risk.tone} />
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Field label="Entry Price" value={entry} onChangeText={setEntry} keyboardType="decimal-pad" placeholder="Contoh: 2650.5" />
        <OptionChips label="Stop Loss" options={[{ value: "PIPS", label: "Pips" }, { value: "PRICE", label: "Harga" }]} value={slMode} onChange={setSlMode} />
        <Field label={slMode === "PIPS" ? "SL (pips)" : "Harga SL"} value={slValue} onChangeText={setSlValue} keyboardType="decimal-pad" />
        <OptionChips
          label="Take Profit (opsional)"
          options={[{ value: "RR", label: "R:R" }, { value: "PIPS", label: "Pips" }, { value: "PRICE", label: "Harga" }]}
          value={tpMode}
          onChange={setTpMode}
        />
        <Field
          label={tpMode === "RR" ? "Rasio reward (x risk)" : tpMode === "PIPS" ? "TP (pips)" : "Harga TP"}
          value={tpValue}
          onChangeText={setTpValue}
          keyboardType="decimal-pad"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "45%", flexGrow: 1, gap: 2 },
  copy: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  quick: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
