import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Card, Screen, T } from "@/components/ui";
import { CalendarSkeleton } from "@/components/Skeletons";
import { BackHeader, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDayWib, formatTimeWib, todayWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { fetchFullCalendar, type CalendarEvent } from "@/lib/market";

type ImpactFilter = "HIGH" | "HIGH_MEDIUM" | "ALL";
const WIB_MS = 7 * 3600_000;
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + WIB_MS).toISOString().slice(0, 10);
const CURRENCIES = ["ALL", "USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNY"];

/** Kalender ekonomi lengkap (minggu lalu–minggu depan) dengan Actual. Sama dengan tab Jadwal di /news web. */
export default function CalendarScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<ImpactFilter>("HIGH_MEDIUM");
  const [currency, setCurrency] = useState("ALL");
  const [showPast, setShowPast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await fetchFullCalendar());
      setError(null);
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!events) load();
    }, [load, events])
  );

  const days = useMemo(() => {
    const today = todayWib();
    const filtered = (events ?? [])
      .filter((e) => (impact === "ALL" ? true : impact === "HIGH" ? e.impact === "HIGH" : e.impact === "HIGH" || e.impact === "MEDIUM"))
      .filter((e) => currency === "ALL" || e.currency === currency)
      .filter((e) => showPast || dayKey(e.dateISO) >= today)
      .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const k = dayKey(e.dateISO);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return Array.from(map.entries());
  }, [events, impact, currency, showPast]);

  if (!session) return <Redirect href="/login" />;

  const impactColor = (i: CalendarEvent["impact"]) =>
    i === "HIGH" ? colors.error : i === "MEDIUM" ? colors.warning : i === "LOW" ? colors.success : colors.textMuted;
  const today = todayWib();

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Kalender Ekonomi" />
      <T variant="bodySm" color="textSecondary">Kalender ekonomi lengkap dengan hasil rilis (Actual). Semua waktu dalam WIB.</T>
      <OptionChips
        label="Impact"
        options={[
          { value: "HIGH", label: "High" },
          { value: "HIGH_MEDIUM", label: "High + Medium" },
          { value: "ALL", label: "Semua" },
        ]}
        value={impact}
        onChange={setImpact}
      />
      <OptionChips label="Mata uang" options={CURRENCIES.map((c) => ({ value: c, label: c === "ALL" ? "Semua" : c }))} value={currency} onChange={setCurrency} />
      <T variant="bodySm" color="primary" style={{ fontWeight: "700" }} onPress={() => setShowPast((v) => !v)}>
        {showPast ? "Sembunyikan hari yang sudah lewat" : "Tampilkan hari yang sudah lewat"}
      </T>
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!events && !error && <CalendarSkeleton />}
      {events && days.length === 0 && <T variant="bodySm" color="textMuted">Tidak ada event untuk filter ini.</T>}

      {days.map(([day, list]) => (
        <Card key={day} style={{ gap: 0, paddingVertical: 8 }}>
          <T variant="label" color={day === today ? "primary" : "textMuted"} style={{ paddingVertical: 6 }}>
            {formatDayWib(list[0].dateISO)}
            {day === today ? " · Hari ini" : ""}
          </T>
          {list.map((e, i) => (
            <View key={e.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <T variant="caption" color="textSecondary" style={{ width: 40 }}>{formatTimeWib(e.dateISO)}</T>
              <View style={[styles.impact, { backgroundColor: impactColor(e.impact) }]} />
              <T variant="caption" style={{ width: 32, fontWeight: "700" }}>{e.currency}</T>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodySm">{e.title}</T>
                <T variant="caption" color="textMuted">
                  {e.actual ? `A: ${e.actual} · ` : ""}F: {e.forecast || "—"} · P: {e.previous || "—"}
                </T>
              </View>
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 9 },
  impact: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
