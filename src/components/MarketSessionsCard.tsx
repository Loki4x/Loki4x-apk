import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import {
  computeSessions,
  DAY,
  fmtClock,
  fmtDuration,
  isWeekendClosed,
  minutesUntilMarketOpen,
  wibParts,
} from "@/shared/market-sessions";

export function MarketSessionsCard() {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { t, locale } = useI18n();
  const dur = (min: number) => fmtDuration(min, locale === "en");
  const sessions = computeSessions(now);
  const weekend = isWeekendClosed(now);
  const wibNow = wibParts(now).minutes;
  const active = sessions.find((s) => s.open);
  const next = [...sessions].sort((a, b) => a.countdown - b.countdown)[0];

  let status: { text: string; bg: string; fg: string };
  if (weekend) {
    status = {
      text: t("Pasar tutup (weekend) · buka dalam {d}", { d: dur(minutesUntilMarketOpen(now)) }),
      bg: colors.errorSubtle,
      fg: colors.error,
    };
  } else if (active) {
    status = {
      text: t("Kill zone {name} aktif · selesai dalam {d}", { name: active.label, d: dur(active.countdown) }),
      bg: colors.successSubtle,
      fg: colors.success,
    };
  } else {
    status = {
      text: t("Di luar kill zone · {name} mulai dalam {d}", { name: next.label, d: dur(next.countdown) }),
      bg: colors.surface2,
      fg: colors.textSecondary,
    };
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <T style={{ fontWeight: "600" }}>Jam Sesi Pasar</T>
          </View>
          <T variant="caption" color="textMuted">Kill zone ICT · semua jam dalam WIB</T>
        </View>
        <T variant="h3" style={{ fontVariant: ["tabular-nums"] }}>{fmtClock(wibNow)}</T>
      </View>

      <View style={[styles.status, { backgroundColor: status.bg }]}>
        <T variant="bodySm" style={{ color: status.fg, fontWeight: "600" }}>{status.text}</T>
      </View>

      {sessions.map((s) => {
        const segments: [number, number][] =
          s.wibEnd > s.wibStart ? [[s.wibStart, s.wibEnd]] : [[s.wibStart, DAY], [0, s.wibEnd]];
        return (
          <View key={s.key} style={{ gap: 4 }}>
            <View style={styles.row}>
              <T variant="bodySm" style={{ fontWeight: "600", flex: 1 }}>{s.label}</T>
              <T variant="caption" color="textSecondary" style={{ fontVariant: ["tabular-nums"] }}>
                {fmtClock(s.wibStart)} – {fmtClock(s.wibEnd)}
              </T>
              <Badge label={s.open ? "Buka" : "Tutup"} tone={s.open ? "success" : "muted"} />
            </View>
            <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
              {segments.map(([a, b]) => (
                <View
                  key={a}
                  style={[
                    styles.segment,
                    {
                      left: `${(a / DAY) * 100}%`,
                      width: `${((b - a) / DAY) * 100}%`,
                      backgroundColor: colors[s.color],
                      opacity: s.open ? 1 : 0.4,
                    },
                  ]}
                />
              ))}
              <View style={[styles.marker, { left: `${(wibNow / DAY) * 100}%`, backgroundColor: colors.text }]} />
            </View>
            <T variant="caption" color="textMuted">
              {s.open ? t("Selesai dalam {d}", { d: dur(s.countdown) }) : t("Mulai dalam {d}", { d: dur(s.countdown) })}
            </T>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  status: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  track: { height: 8, borderRadius: 99, overflow: "hidden", position: "relative" },
  segment: { position: "absolute", top: 0, bottom: 0, borderRadius: 99 },
  marker: { position: "absolute", top: 0, bottom: 0, width: 2 },
});
