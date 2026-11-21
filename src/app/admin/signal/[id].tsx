import { useCallback, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Screen, T } from "@/components/ui";
import { DetailSkeleton } from "@/components/Skeletons";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { pickPhoto } from "@/lib/media";
import { fetchSignal, formatPrice, STATUS_META, UPDATE_LABEL } from "@/lib/signals";
import {
  addSignalUpdate,
  cleanNum,
  deleteSignal,
  pipsBetween,
  RESULT_STATUSES,
  SIGNAL_STATUSES,
  TERMINAL,
  toNum,
  UPDATE_TYPES,
  updateSignalStatus,
  wibDateTime,
} from "@/lib/admin";
import type { Signal, SignalStatus, SignalUpdate, SignalUpdateType } from "@/shared/signal-types";
import { useI18n } from "@/lib/i18n";

/** Admin: ubah status/hasil sinyal, kirim update, atau hapus. */
export default function AdminSignalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [signal, setSignal] = useState<Signal | null | undefined>(undefined);
  const [updates, setUpdates] = useState<SignalUpdate[]>([]);

  // Status
  const [status, setStatus] = useState<SignalStatus>("OPEN");
  const [closing, setClosing] = useState("");
  const [pips, setPips] = useState("");
  const [closedAt, setClosedAt] = useState("");
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Update
  const [updType, setUpdType] = useState<SignalUpdateType>("SL_TO_BE");
  const [updMessage, setUpdMessage] = useState("");
  const [updPrice, setUpdPrice] = useState("");
  const [updNotify, setUpdNotify] = useState(true);
  const [savingUpd, setSavingUpd] = useState(false);
  const [updMsg, setUpdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetchSignal(String(id)).catch(() => ({ signal: null, updates: [] as SignalUpdate[] }));
    setSignal(res.signal);
    setUpdates(res.updates);
    if (res.signal) setStatus(res.signal.status);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const terminal = TERMINAL.includes(status);
  const needsResult = RESULT_STATUSES.includes(status);
  const closeNum = signal ? toNum(closing) ?? (status === "TP" ? signal.take_profit : status === "SL" ? signal.stop_loss : null) : null;
  const suggested = signal && needsResult && closeNum !== null ? pipsBetween(signal.symbol, signal.side, signal.entry_price, closeNum) : null;

  async function saveStatus() {
    if (!signal) return;
    setStatusMsg(null);
    const closed = wibDateTime(closedAt);
    if (closed === "invalid") {
      setStatusMsg({ ok: false, text: "Format tanggal: YYYY-MM-DD HH:mm (WIB). Kosongkan untuk sekarang." });
      return;
    }
    if (needsResult && closeNum === null) {
      setStatusMsg({ ok: false, text: "Isi harga penutupan." });
      return;
    }
    setSavingStatus(true);
    try {
      await updateSignalStatus(
        signal.id,
        {
          status,
          current_price: needsResult && closeNum !== null ? String(closeNum) : "",
          result_pips: needsResult ? cleanNum(pips) || (suggested !== null ? String(suggested) : "0") : "",
          closed_at: terminal ? closed ?? "" : "",
        },
        terminal ? resultImg : null
      );
      setStatusMsg({ ok: true, text: "Status tersimpan." });
      setResultImg(null);
      await load();
    } catch (err) {
      setStatusMsg({ ok: false, text: friendlyApiError(err) });
    } finally {
      setSavingStatus(false);
    }
  }

  async function sendUpdate() {
    if (!signal) return;
    setUpdMsg(null);
    setSavingUpd(true);
    try {
      await addSignalUpdate(signal.id, { type: updType, message: updMessage.trim(), price: cleanNum(updPrice), send_email: updNotify ? "1" : "0" });
      setUpdMessage("");
      setUpdPrice("");
      setUpdMsg({ ok: true, text: "Update terkirim." });
      await load();
    } catch (err) {
      setUpdMsg({ ok: false, text: friendlyApiError(err) });
    } finally {
      setSavingUpd(false);
    }
  }

  function confirmDelete() {
    if (!signal) return;
    Alert.alert(t("Hapus sinyal"), t("Sinyal {name} akan dihapus permanen (juga dari track record).", { name: `${signal.symbol} ${signal.side}` }), [
      { text: t("Batal"), style: "cancel" },
      {
        text: t("Hapus"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSignal(signal.id);
            router.back();
          } catch (err) {
            Alert.alert(t("Gagal"), t(friendlyApiError(err)));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <BackHeader title="Admin · Sinyal" fallback="/admin/signals" />
      {signal === undefined && <DetailSkeleton />}
      {signal === null && <T variant="bodySm" color="error">Sinyal tidak ditemukan.</T>}
      {signal && (
        <>
          <Card>
            <View style={styles.between}>
              <T variant="h3">{signal.symbol} {signal.side}</T>
              <Badge label={STATUS_META[signal.status].label} tone={STATUS_META[signal.status].tone} />
            </View>
            <T variant="bodySm" color="textSecondary">
              Entry {formatPrice(signal.entry_price, signal.symbol)} · TP {formatPrice(signal.take_profit, signal.symbol)} · SL{" "}
              {formatPrice(signal.stop_loss, signal.symbol)}
            </T>
            <T variant="caption" color="textMuted">Diposting {formatDateTimeWib(signal.posted_at)}</T>
          </Card>

          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Ubah status</T>
            <OptionChips
              label="Status"
              options={SIGNAL_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              value={status}
              onChange={setStatus}
            />
            {needsResult && (
              <View style={styles.row}>
                <Field
                  label="Harga penutupan"
                  value={closing}
                  onChangeText={setClosing}
                  keyboardType="decimal-pad"
                  placeholder={status === "TP" && signal.take_profit ? String(signal.take_profit) : status === "SL" && signal.stop_loss ? String(signal.stop_loss) : ""}
                />
                <Field label="Hasil (pips)" value={pips} onChangeText={setPips} keyboardType="numbers-and-punctuation" placeholder={suggested !== null ? String(suggested) : "0"} />
              </View>
            )}
            {suggested !== null && <T variant="caption" color="textMuted">Hitungan dari harga: {suggested} pips (dipakai kalau kolom pips kosong).</T>}
            {terminal && (
              <>
                <Field label="Tanggal ditutup (WIB, opsional)" value={closedAt} onChangeText={setClosedAt} placeholder="Kosong = sekarang" />
                <Pressable
                  onPress={async () => {
                    const uri = await pickPhoto().catch(() => null);
                    if (uri) setResultImg(uri);
                  }}
                  style={[styles.photo, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
                >
                  {resultImg ? (
                    <Image source={{ uri: resultImg }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : (
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                      <T variant="caption" color="textMuted">Foto hasil (opsional)</T>
                    </View>
                  )}
                </Pressable>
              </>
            )}
            {statusMsg && <T variant="bodySm" color={statusMsg.ok ? "success" : "error"}>{statusMsg.text}</T>}
            <Button title="Simpan status" onPress={saveStatus} loading={savingStatus} />
          </Card>

          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Kirim update</T>
            <OptionChips label="Jenis" options={UPDATE_TYPES.map((u) => ({ value: u, label: UPDATE_LABEL[u] }))} value={updType} onChange={setUpdType} />
            {updType !== "SL_TO_BE" && updType !== "NOTE" && (
              <Field label="Harga (opsional)" value={updPrice} onChangeText={setUpdPrice} keyboardType="decimal-pad" />
            )}
            <Field
              label={updType === "NOTE" ? "Pesan (wajib)" : "Pesan (opsional)"}
              value={updMessage}
              onChangeText={setUpdMessage}
              multiline
              autoCapitalize="sentences"
            />
            <Pressable onPress={() => setUpdNotify((v) => !v)} style={styles.check}>
              <Ionicons name={updNotify ? "checkbox" : "square-outline"} size={22} color={updNotify ? colors.primary : colors.textMuted} />
              <T variant="bodySm" color="textSecondary">Kirim notifikasi ke member</T>
            </Pressable>
            {updMsg && <T variant="bodySm" color={updMsg.ok ? "success" : "error"}>{updMsg.text}</T>}
            <Button title="Kirim update" variant="secondary" onPress={sendUpdate} loading={savingUpd} />
            {updates.length > 0 && (
              <View style={{ gap: 6 }}>
                {updates.map((u) => (
                  <T key={u.id} variant="caption" color="textMuted">
                    {formatDateTimeWib(u.created_at)} · {UPDATE_LABEL[u.type]}
                    {u.price !== null ? ` @ ${formatPrice(u.price, signal.symbol)}` : ""}
                    {u.message ? ` — ${u.message}` : ""}
                  </T>
                ))}
              </View>
            )}
          </Card>

          <Button title="Hapus sinyal" variant="secondary" onPress={confirmDelete} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  photo: { height: 130, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  check: { flexDirection: "row", alignItems: "center", gap: 10 },
});
