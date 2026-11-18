import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, ProgressBar, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { formatMoney, formatPnl } from "@/lib/format";
import type { DisciplineSummary, RuleLevel, RuleStatus } from "@/shared/discipline";
import type { AccountCurrency } from "@/shared/journal-types";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function ruleText(r: RuleStatus): { label: string; value: string } {
  switch (r.key) {
    case "daily_loss":
      return { label: "Rugi hari ini", value: `${r.current.toFixed(1)}% / ${r.limit}%` };
    case "trades_per_day":
      return { label: "Trade hari ini", value: `${r.current} / ${r.limit}` };
    case "consecutive_losses":
      return { label: "Loss beruntun hari ini", value: `${r.current} / ${r.limit}` };
  }
}

export function DisciplineCard({
  summary,
  currency,
  onEdit,
}: {
  summary: DisciplineSummary;
  currency: AccountCurrency;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const levelColor: Record<RuleLevel, string> = { ok: colors.success, warn: colors.warning, breached: colors.error };
  const [y, m] = summary.month.split("-").map(Number);
  const monthLabel = `${MONTHS[(m || 1) - 1]} ${y}`;
  const empty = !summary.hasRules && !summary.hasGoals;

  return (
    <Card>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
        <T style={{ fontWeight: "600", flex: 1 }}>Disiplin & Target</T>
        <Pressable onPress={onEdit} hitSlop={10} style={[styles.edit, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="options-outline" size={14} color={colors.text} />
          <T variant="caption" style={{ fontWeight: "600" }}>Atur</T>
        </Pressable>
      </View>

      {empty ? (
        <T variant="bodySm" color="textSecondary">
          Belum ada aturan risiko & target. Pasang batas rugi harian, batas jumlah trade, dan target bulanan supaya trading lebih
          disiplin.
        </T>
      ) : (
        <>
          {summary.overall === "breached" && (
            <View style={[styles.alert, { backgroundColor: colors.errorSubtle }]}>
              <T variant="bodySm" color="error" style={{ fontWeight: "600" }}>
                ⛔ Batas hari ini sudah tercapai. Sebaiknya berhenti trading dan lanjut besok.
              </T>
            </View>
          )}
          {summary.overall === "warn" && (
            <View style={[styles.alert, { backgroundColor: colors.warningSubtle }]}>
              <T variant="bodySm" color="warning" style={{ fontWeight: "600" }}>
                ⚠️ Hampir mencapai batas hari ini. Lebih selektif ya.
              </T>
            </View>
          )}

          {summary.rules.map((r) => {
            const { label, value } = ruleText(r);
            return (
              <View key={r.key} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <T variant="bodySm" color="textSecondary">{label}</T>
                  <T variant="bodySm" style={{ fontWeight: "700", color: levelColor[r.level] }}>{value}</T>
                </View>
                <ProgressBar percent={(r.current / r.limit) * 100} color={levelColor[r.level]} />
              </View>
            );
          })}
          {summary.hasRules && (
            <T variant="caption" color="textMuted">
              P&L hari ini:{" "}
              <T variant="caption" style={{ fontWeight: "700", color: summary.todayPnl >= 0 ? colors.success : colors.error }}>
                {formatPnl(summary.todayPnl, currency)}
              </T>
            </T>
          )}

          {summary.hasGoals && <T variant="label" color="textMuted" style={{ marginTop: 4 }}>Target {monthLabel}</T>}
          {summary.profitGoal && (
            <View style={{ gap: 4 }}>
              <View style={styles.row}>
                <T variant="bodySm" color="textSecondary">Profit</T>
                <T variant="bodySm" style={{ fontWeight: "700" }}>
                  {formatPnl(summary.profitGoal.current, currency)}{" "}
                  <T variant="bodySm" color="textMuted">/ {formatMoney(summary.profitGoal.target, currency)}</T>
                </T>
              </View>
              <ProgressBar percent={summary.profitGoal.percent} color={summary.profitGoal.reached ? colors.success : colors.primary} />
            </View>
          )}
          {summary.winRateGoal && (
            <View style={{ gap: 4 }}>
              <View style={styles.row}>
                <T variant="bodySm" color="textSecondary">Win rate ({summary.monthClosedTrades} trade)</T>
                <T variant="bodySm" style={{ fontWeight: "700" }}>
                  {summary.winRateGoal.current.toFixed(0)}% <T variant="bodySm" color="textMuted">/ {summary.winRateGoal.target}%</T>
                </T>
              </View>
              <ProgressBar percent={summary.winRateGoal.percent} color={summary.winRateGoal.reached ? colors.success : colors.primary} />
            </View>
          )}
        </>
      )}

      <View style={[styles.streak, { backgroundColor: colors.surface2 }]}>
        <Ionicons name="flame" size={20} color={summary.streak > 0 ? colors.warning : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <T variant="bodySm" style={{ fontWeight: "700" }}>{summary.streak} hari disiplin beruntun</T>
          <T variant="caption" color="textMuted">Rekor: {summary.bestStreak} hari · sesuai rencana & tidak melanggar aturan</T>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  edit: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  alert: { borderRadius: 10, padding: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  streak: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 10 },
});
