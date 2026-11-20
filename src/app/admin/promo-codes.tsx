import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Redirect } from "expo-router";
import { Badge, Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { createPromo, idr, PLAN_LABEL, PROMO_PLANS, setPromoActive, type PromoCode } from "@/lib/admin";
import { useAdminData } from "@/lib/use-admin-data";

const EMPTY = { code: "", type: "PERCENT" as "PERCENT" | "FIXED_IDR", value: "", max_uses: "", valid_from: "", valid_until: "", note: "" };

/** Kode promo diskon (sama dengan /admin/promo-codes di web). Harga akhir tetap dihitung server. */
export default function AdminPromoCodesScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { data, setData, error, load, refresh, refreshing } = useAdminData<PromoCode[]>("promo-codes");
  const [form, setForm] = useState(EMPTY);
  const [plans, setPlans] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      await createPromo({ ...form, code: form.code.trim().toUpperCase(), value: form.value.trim().replace(/[.,]/g, form.type === "FIXED_IDR" ? "" : "."), plans });
      setForm(EMPTY);
      setPlans([]);
      setOpen(false);
      setMsg({ ok: true, text: t("Kode promo dibuat.") });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: friendlyApiError(e) });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: PromoCode) {
    setData((list) => list?.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)) ?? null);
    try {
      await setPromoActive(p.id, !p.active);
    } catch (e) {
      setMsg({ ok: false, text: friendlyApiError(e) });
      load();
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <BackHeader title="Kode Promo" fallback="/admin" />
      <T variant="bodySm" color="textSecondary">Buat kode diskon untuk pembayaran paket. Harga akhir dihitung di server saat user membayar.</T>
      {msg && <T variant="bodySm" color={msg.ok ? "success" : "error"}>{msg.text}</T>}

      {!open ? (
        <Button title="+ Buat kode promo" onPress={() => setOpen(true)} />
      ) : (
        <Card>
          <T variant="h3">Kode promo baru</T>
          <Field label="Kode" value={form.code} onChangeText={set("code")} placeholder="HEMAT20" autoCapitalize="characters" hint="3–32 karakter: huruf besar, angka, - atau _." />
          <OptionChips
            label="Jenis diskon"
            options={[
              { value: "PERCENT", label: "Persen (%)" },
              { value: "FIXED_IDR", label: "Potongan Rupiah" },
            ]}
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
          />
          <Field
            label={form.type === "PERCENT" ? "Diskon (%)" : "Potongan (Rp)"}
            value={form.value}
            onChangeText={set("value")}
            keyboardType="numeric"
            placeholder={form.type === "PERCENT" ? "20" : "50000"}
            hint={form.type === "PERCENT" ? "1–95%." : "Rp1.000 – Rp1.000.000."}
          />
          <Field label="Batas pemakaian (opsional)" value={form.max_uses} onChangeText={set("max_uses")} keyboardType="numeric" placeholder="Tanpa batas" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Field label="Mulai (opsional)" value={form.valid_from} onChangeText={set("valid_from")} placeholder="YYYY-MM-DD" />
            <Field label="Berakhir (opsional)" value={form.valid_until} onChangeText={set("valid_until")} placeholder="YYYY-MM-DD" />
          </View>
          <View style={{ gap: 6 }}>
            <T variant="bodySm" color="textSecondary">Berlaku untuk paket</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PROMO_PLANS.map((p) => {
                const on = plans.includes(p);
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPlans((list) => (on ? list.filter((x) => x !== p) : [...list, p]))}
                    style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySubtle : colors.surface2 }]}
                  >
                    <T variant="bodySm" style={{ fontWeight: "600", color: on ? colors.primary : colors.textSecondary }}>{PLAN_LABEL[p]}</T>
                  </Pressable>
                );
              })}
            </View>
            <T variant="caption" color="textMuted">Tidak memilih apa pun = berlaku untuk semua paket.</T>
          </View>
          <Field label="Catatan (opsional)" value={form.note} onChangeText={set("note")} autoCapitalize="sentences" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button title="Batal" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} />
            <Button title="Simpan" onPress={submit} loading={saving} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      {error && <T variant="bodySm" color="error">{error}</T>}
      {!data && !error && <SkeletonPage variant="list" />}
      {data && data.length === 0 && (
        <Card>
          <T variant="bodySm" color="textMuted">Belum ada kode promo.</T>
        </Card>
      )}
      {data?.map((p) => (
        <Card key={p.id} style={{ opacity: p.active ? 1 : 0.7 }}>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h3">{p.code}</T>
              <T variant="bodySm" style={{ fontWeight: "700" }} color="primary">
                {p.type === "PERCENT" ? `${p.value}%` : idr(p.value)}
              </T>
            </View>
            <Switch value={p.active} onValueChange={() => toggle(p)} trackColor={{ true: colors.primary, false: colors.surface2 }} thumbColor="#FFFFFF" />
          </View>
          <T variant="caption" color="textSecondary">
            {t("Dipakai")} {p.used_count}
            {p.max_uses ? `/${p.max_uses}` : ""} · {p.plans?.length ? p.plans.map((x) => PLAN_LABEL[x] ?? x).join(", ") : t("Semua paket")}
          </T>
          {(p.valid_from || p.valid_until) && (
            <T variant="caption" color="textMuted">
              {p.valid_from ? formatDate(p.valid_from) : "…"} – {p.valid_until ? formatDate(p.valid_until) : "…"}
            </T>
          )}
          {p.note ? <T variant="caption" color="textMuted">{p.note}</T> : null}
          <Badge label={p.active ? "Aktif" : "Nonaktif"} tone={p.active ? "success" : "muted"} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
