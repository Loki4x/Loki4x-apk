import { useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field, normalizeNumber, OptionChips } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { todayWib } from "@/lib/format";
import {
  createTrade,
  deleteTrade,
  deleteTradePhoto,
  fetchTrade,
  friendlyApiError,
  pickPhoto,
  updateTrade,
  uploadTradePhoto,
  type PhotoSlot,
  type TradeInput,
} from "@/lib/journal";
import { EMOTION_LABEL, EMOTIONS, STRATEGY_PRESETS } from "@/shared/journal-tags";
import { useI18n } from "@/lib/i18n";

const EMPTY: TradeInput = {
  symbol: "",
  side: "BUY",
  entry_price: "",
  exit_price: "",
  pips: "",
  pnl_manual: "",
  trade_date: todayWib(),
  session: "",
  strategy: "",
  emotion: "",
  followed_plan: "",
  confluence: "",
  notes: "",
};

interface PhotoState {
  /** URL foto yang sudah tersimpan di server. */
  existing: string | null;
  /** Foto baru dari galeri (belum diupload). */
  local: string | null;
  /** Foto lama diminta dihapus. */
  removed: boolean;
}
const NO_PHOTO: PhotoState = { existing: null, local: null, removed: false };
const SLOTS: { slot: PhotoSlot; label: string }[] = [
  { slot: "before", label: "Foto before (sebelum entry)" },
  { slot: "after", label: "Foto after (hasil)" },
];

const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** /trade/new?account=<id> untuk trade baru, /trade/<id> untuk mengedit. */
export default function TradeFormScreen() {
  const { id, account } = useLocalSearchParams<{ id: string; account?: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const isNew = id === "new";
  const [form, setForm] = useState<TradeInput>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<PhotoSlot, PhotoState>>({ before: NO_PHOTO, after: NO_PHOTO });

  useEffect(() => {
    if (isNew || !session) return;
    fetchTrade(session.user.id, String(id)).then((t) => {
      if (t) {
        setForm({
          symbol: t.symbol,
          side: t.side,
          entry_price: str(t.entry_price),
          exit_price: str(t.exit_price),
          pips: str(t.pips),
          // P&L yang tersimpan dipakai sebagai "P&L manual" supaya nilainya tidak berubah saat disimpan ulang.
          pnl_manual: str(t.pnl),
          trade_date: t.trade_date,
          session: t.session ?? "",
          strategy: t.strategy ?? "",
          emotion: t.emotion ?? "",
          followed_plan: t.followed_plan === true ? "yes" : t.followed_plan === false ? "no" : "",
          confluence: t.confluence ?? "",
          notes: t.notes ?? "",
        });
        setPhotos({
          before: { ...NO_PHOTO, existing: t.before_photo_url },
          after: { ...NO_PHOTO, existing: t.after_photo_url },
        });
      } else {
        setError("Trade tidak ditemukan.");
      }
      setLoading(false);
    });
  }, [id, isNew, session]);

  if (!session) return <Redirect href="/login" />;
  if (!hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/journal" />;

  const set = <K extends keyof TradeInput>(key: K) => (value: TradeInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setError(null);
    const payload: TradeInput = {
      ...form,
      symbol: form.symbol.trim().toUpperCase(),
      entry_price: normalizeNumber(form.entry_price),
      exit_price: normalizeNumber(form.exit_price),
      pips: normalizeNumber(form.pips),
      pnl_manual: normalizeNumber(form.pnl_manual),
      trade_date: form.trade_date.trim(),
    };
    if (!payload.symbol || !payload.entry_price) {
      setError("Isi symbol dan harga entry.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.trade_date)) {
      setError("Format tanggal YYYY-MM-DD, contoh 2026-11-18.");
      return;
    }
    setSaving(true);
    let tradeId: string | null = isNew ? null : String(id);
    try {
      if (isNew) {
        if (!account) throw new Error("Akun journaling tidak diketahui.");
        tradeId = (await createTrade(String(account), payload)).id;
      } else {
        await updateTrade(String(id), payload);
      }
    } catch (err) {
      setError(friendlyApiError(err));
      setSaving(false);
      return;
    }

    // Trade sudah tersimpan; lanjut foto. Gagal upload tidak membatalkan trade-nya.
    let photoError: string | null = null;
    if (tradeId) {
      for (const { slot } of SLOTS) {
        const p = photos[slot];
        try {
          if (p.local) await uploadTradePhoto(tradeId, slot, p.local);
          else if (p.removed && p.existing) await deleteTradePhoto(tradeId, slot);
        } catch (err) {
          photoError = friendlyApiError(err);
        }
      }
    }
    setSaving(false);
    if (photoError) {
      Alert.alert(t("Trade tersimpan"), t("Tapi foto gagal diupload: {error}. Coba tambahkan lagi lewat Edit trade.", { error: t(photoError) }), [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  async function choosePhoto(slot: PhotoSlot) {
    try {
      const uri = await pickPhoto();
      if (uri) setPhotos((p) => ({ ...p, [slot]: { ...p[slot], local: uri, removed: false } }));
    } catch {
      setError("Foto tidak bisa dibuka. Coba pilih foto lain.");
    }
  }

  function removePhoto(slot: PhotoSlot) {
    setPhotos((p) => ({ ...p, [slot]: { ...p[slot], local: null, removed: true } }));
  }

  function confirmDelete() {
    Alert.alert(t("Hapus trade"), t("Trade ini akan dihapus permanen dari jurnal."), [
      { text: t("Batal"), style: "cancel" },
      {
        text: t("Hapus"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTrade(String(id));
            router.back();
          } catch (err) {
            setError(friendlyApiError(err));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <BackHeader title={isNew ? "Tambah Trade" : "Edit Trade"} fallback="/journal" />

      {loading ? (
        <SkeletonPage variant="detail" />
      ) : (
        <>
          <Card style={{ gap: 14 }}>
            <View style={styles.row}>
              <Field label="Symbol" value={form.symbol} onChangeText={set("symbol")} placeholder="XAUUSD" autoCapitalize="characters" />
              <Field label="Tanggal (WIB)" value={form.trade_date} onChangeText={set("trade_date")} placeholder="2026-11-18" />
            </View>
            <OptionChips
              label="Arah"
              options={[
                { value: "BUY", label: "BUY" },
                { value: "SELL", label: "SELL" },
              ]}
              value={form.side}
              onChange={set("side")}
            />
            <View style={styles.row}>
              <Field label="Harga entry" value={form.entry_price} onChangeText={set("entry_price")} keyboardType="decimal-pad" />
              <Field label="Harga exit" value={form.exit_price} onChangeText={set("exit_price")} keyboardType="decimal-pad" hint="Kosongkan kalau masih open" />
            </View>
            <View style={styles.row}>
              <Field label="Pips" value={form.pips} onChangeText={set("pips")} keyboardType="numbers-and-punctuation" placeholder="25 / -10" />
              <Field label="Profit/Loss" value={form.pnl_manual} onChangeText={set("pnl_manual")} keyboardType="numbers-and-punctuation" placeholder="50 / -25.5" />
            </View>
            <T variant="caption" color="textMuted">
              Kalau Profit/Loss dikosongkan tapi harga exit diisi, P&L dihitung dari selisih harga (sama seperti di web).
            </T>
          </Card>

          <Card style={{ gap: 14 }}>
            <OptionChips
              label="Sesi"
              options={[
                { value: "", label: "Tidak diisi" },
                { value: "ASIA", label: "Asia" },
                { value: "LONDON", label: "London" },
                { value: "NEW_YORK", label: "New York" },
                { value: "OVERLAP", label: "Overlap" },
              ]}
              value={form.session}
              onChange={set("session")}
            />
            <View style={{ gap: 6 }}>
              <Field label="Strategi" value={form.strategy} onChangeText={set("strategy")} placeholder="Pilih atau tulis sendiri" autoCapitalize="sentences" />
              <View style={styles.presets}>
                {STRATEGY_PRESETS.map((p) => (
                  <Pressable key={p} onPress={() => set("strategy")(p)} style={[styles.preset, { backgroundColor: colors.surface2 }]}>
                    <T variant="caption" color="textSecondary">{p}</T>
                  </Pressable>
                ))}
              </View>
            </View>
            <OptionChips
              label="Emosi saat entry"
              options={[{ value: "", label: "Tidak diisi" }, ...EMOTIONS.map((e) => ({ value: e as string, label: EMOTION_LABEL[e] }))]}
              value={form.emotion}
              onChange={set("emotion")}
            />
            <OptionChips
              label="Sesuai rencana?"
              options={[
                { value: "", label: "Tidak diisi" },
                { value: "yes", label: "Ya" },
                { value: "no", label: "Tidak" },
              ]}
              value={form.followed_plan}
              onChange={set("followed_plan")}
            />
          </Card>

          <Card style={{ gap: 14 }}>
            <Field label="Confluence (alasan entry)" value={form.confluence} onChangeText={set("confluence")} multiline autoCapitalize="sentences" placeholder="SNR, trend, news, konfirmasi indikator…" />
            <Field label="Catatan" value={form.notes} onChangeText={set("notes")} multiline autoCapitalize="sentences" placeholder="Setup, evaluasi, pelajaran…" />
          </Card>

          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Screenshot chart</T>
            <View style={styles.photos}>
              {SLOTS.map(({ slot, label }) => {
                const p = photos[slot];
                const shown = p.local ?? (p.removed ? null : p.existing);
                return (
                  <View key={slot} style={{ flex: 1, gap: 6 }}>
                    <T variant="caption" color="textSecondary">{label}</T>
                    <Pressable
                      onPress={() => choosePhoto(slot)}
                      style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
                    >
                      {shown ? (
                        <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <View style={{ alignItems: "center", gap: 4 }}>
                          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                          <T variant="caption" color="textMuted">Pilih foto</T>
                        </View>
                      )}
                    </Pressable>
                    {shown && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <T variant="caption" color="primary" style={{ fontWeight: "700" }} onPress={() => choosePhoto(slot)}>Ganti</T>
                        <T variant="caption" color="error" style={{ fontWeight: "700" }} onPress={() => removePhoto(slot)}>Hapus</T>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            <T variant="caption" color="textMuted">Foto otomatis diperkecil sebelum diupload. Tersimpan juga di Journal web.</T>
          </Card>

          {error && (
            <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
              <T variant="bodySm" color="error">{error}</T>
            </View>
          )}

          <Button title={isNew ? "Simpan trade" : "Simpan perubahan"} onPress={save} loading={saving} />
          {!isNew && <Button title="Hapus trade" variant="secondary" onPress={confirmDelete} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  preset: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  error: { borderRadius: 10, padding: 10 },
  photos: { flexDirection: "row", gap: 10 },
  photoBox: { aspectRatio: 4 / 3, borderWidth: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
