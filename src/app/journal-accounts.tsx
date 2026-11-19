import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, normalizeNumber, OptionChips } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatMoney } from "@/lib/format";
import { createAccount, deleteAccount, fetchAccounts, friendlyApiError, setActiveAccountId } from "@/lib/journal";
import type { TradingAccount } from "@/shared/journal-types";
import { useI18n } from "@/lib/i18n";

const MAX_ACCOUNTS = 5;

/** Kelola akun journaling: buat (maks 5) dan hapus (minimal tersisa 1). Sama dengan halaman Akun di web. */
export default function JournalAccountsScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<TradingAccount[] | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState<"USD" | "IDR">("USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setAccounts(await fetchAccounts(userId));
    } catch {
      setError("Akun belum bisa dimuat.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;
  if (!hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/journal" />;

  async function add() {
    setError(null);
    if (!name.trim()) {
      setError("Isi nama akun.");
      return;
    }
    setSaving(true);
    try {
      const res = await createAccount({ name: name.trim(), initial_balance: normalizeNumber(balance) || "0", currency });
      if (res.id) await setActiveAccountId(res.id);
      setName("");
      setBalance("");
      await load();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(a: TradingAccount) {
    Alert.alert(t("Hapus akun"), t('Akun "{name}" dan SEMUA trade di dalamnya akan dihapus permanen.', { name: a.name }), [
      { text: t("Batal"), style: "cancel" },
      {
        text: t("Hapus"),
        style: "destructive",
        onPress: async () => {
          setError(null);
          try {
            await deleteAccount(a.id);
            await load();
          } catch (err) {
            setError(friendlyApiError(err));
          }
        },
      },
    ]);
  }

  const full = (accounts?.length ?? 0) >= MAX_ACCOUNTS;

  return (
    <Screen>
      <BackHeader title="Akun Journaling" fallback="/journal" />
      <T variant="bodySm" color="textSecondary">
        Pisahkan jurnal per akun (mis. akun real, akun demo, akun prop firm). Maksimal {MAX_ACCOUNTS} akun.
      </T>

      {accounts?.map((a) => (
        <Card key={a.id} style={styles.row}>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T variant="body" style={{ fontWeight: "700" }}>{a.name}</T>
              <Badge label={a.currency} tone="muted" />
            </View>
            <T variant="caption" color="textMuted">Saldo awal {formatMoney(a.initial_balance, a.currency)}</T>
          </View>
          {accounts.length > 1 && (
            <Pressable onPress={() => confirmDelete(a)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          )}
        </Card>
      ))}

      {accounts && !full && (
        <Card style={{ gap: 14 }}>
          <T variant="label" color="textMuted">Tambah akun</T>
          <Field label="Nama akun" value={name} onChangeText={setName} placeholder="Contoh: Akun Real Exness" autoCapitalize="sentences" />
          <Field label="Saldo awal" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder={currency === "IDR" ? "1000000" : "1000"} />
          <OptionChips
            label="Mata uang"
            options={[
              { value: "USD", label: "USD ($)" },
              { value: "IDR", label: "IDR (Rp)" },
            ]}
            value={currency}
            onChange={setCurrency}
          />
          <Button title="Buat akun" onPress={add} loading={saving} />
        </Card>
      )}
      {full && <T variant="caption" color="textMuted">Sudah {MAX_ACCOUNTS} akun (batas maksimal). Hapus salah satu untuk membuat akun baru.</T>}

      {error && (
        <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
          <T variant="bodySm" color="error">{error}</T>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  error: { borderRadius: 10, padding: 10 },
});
