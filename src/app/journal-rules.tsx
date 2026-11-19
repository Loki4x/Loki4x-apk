import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, normalizeNumber } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { fetchAccounts, friendlyApiError, saveRules } from "@/lib/journal";
import type { TradingAccount } from "@/shared/journal-types";
import { useI18n } from "@/lib/i18n";

type RuleKey = "max_daily_loss_pct" | "max_trades_per_day" | "max_consecutive_losses" | "monthly_profit_target" | "target_win_rate";

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export default function JournalRulesScreen() {
  const { account: accountId } = useLocalSearchParams<{ account?: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [values, setValues] = useState<Record<RuleKey, string>>({
    max_daily_loss_pct: "",
    max_trades_per_day: "",
    max_consecutive_losses: "",
    monthly_profit_target: "",
    target_win_rate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchAccounts(session.user.id)
      .then((list) => {
        const a = list.find((x) => x.id === accountId) ?? null;
        setAccount(a);
        if (a) {
          setValues({
            max_daily_loss_pct: str(a.max_daily_loss_pct),
            max_trades_per_day: str(a.max_trades_per_day),
            max_consecutive_losses: str(a.max_consecutive_losses),
            monthly_profit_target: str(a.monthly_profit_target),
            target_win_rate: str(a.target_win_rate),
          });
        }
      })
      .catch(() => setError("Akun belum bisa dimuat."));
  }, [session, accountId]);

  if (!session) return <Redirect href="/login" />;
  if (!hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/journal" />;

  const set = (k: RuleKey) => (v: string) => setValues((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!account) return;
    setError(null);
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, normalizeNumber(v)]));
      await saveRules(account.id, payload);
      router.back();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSaving(false);
    }
  }

  const money = account?.currency === "IDR" ? "Rp" : "$";

  return (
    <Screen>
      <BackHeader title="Aturan & Target" fallback="/journal" />
      <T variant="bodySm" color="textSecondary">
        {account ? `${t("Untuk akun {name}.", { name: account.name })} ` : ""}Kosongkan kolom yang tidak ingin dipakai. Aturan & target ini sama dengan yang ada
        di web.
      </T>

      <Card style={{ gap: 14 }}>
        <T variant="label" color="textMuted">Aturan risiko harian</T>
        <Field label="Batas rugi harian (% saldo)" value={values.max_daily_loss_pct} onChangeText={set("max_daily_loss_pct")} keyboardType="decimal-pad" placeholder="Contoh: 3" />
        <View style={styles.row}>
          <Field label="Maks trade per hari" value={values.max_trades_per_day} onChangeText={set("max_trades_per_day")} keyboardType="number-pad" placeholder="Contoh: 3" />
          <Field label="Maks loss beruntun" value={values.max_consecutive_losses} onChangeText={set("max_consecutive_losses")} keyboardType="number-pad" placeholder="Contoh: 2" />
        </View>
        <T variant="caption" color="textMuted">Kamu akan dapat notifikasi di HP saat salah satu batas ini tercapai.</T>
      </Card>

      <Card style={{ gap: 14 }}>
        <T variant="label" color="textMuted">Target bulanan</T>
        <View style={styles.row}>
          <Field label={t("Target profit ({money})", { money })} value={values.monthly_profit_target} onChangeText={set("monthly_profit_target")} keyboardType="decimal-pad" placeholder={money === "Rp" ? "5000000" : "500"} />
          <Field label="Target win rate (%)" value={values.target_win_rate} onChangeText={set("target_win_rate")} keyboardType="decimal-pad" placeholder="60" />
        </View>
      </Card>

      {error && (
        <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
          <T variant="bodySm" color="error">{error}</T>
        </View>
      )}
      <Button title="Simpan" onPress={save} loading={saving} disabled={!account} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  error: { borderRadius: 10, padding: 10 },
});
