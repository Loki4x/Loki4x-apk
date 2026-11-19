import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, OptionChips } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { friendlyApiError } from "@/lib/journal";
import { pickPhoto } from "@/lib/media";
import { STATUS_META } from "@/lib/signals";
import { cleanNum, createSignal, pipsBetween, RESULT_STATUSES, SIGNAL_STATUSES, TERMINAL, toNum, wibDateTime } from "@/lib/admin";
import type { SignalStatus } from "@/shared/signal-types";

/** Admin: posting sinyal baru (sama dengan form "Tambah Sinyal" di panel admin web). */
export default function AdminSignalNew() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [signalType, setSignalType] = useState<"REGULAR" | "NEWS">("REGULAR");
  const [entry, setEntry] = useState("");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [risk, setRisk] = useState("0.5");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<SignalStatus>("OPEN");
  const [postedAt, setPostedAt] = useState("");
  const [closedAt, setClosedAt] = useState("");
  const [closing, setClosing] = useState("");
  const [pips, setPips] = useState("");
  const [chart, setChart] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const terminal = TERMINAL.includes(status);
  const needsResult = RESULT_STATUSES.includes(status);
  const entryNum = toNum(entry);
  const closeNum = toNum(closing) ?? (status === "TP" ? toNum(tp) : status === "SL" ? toNum(sl) : null);
  const suggested = needsResult && symbol.trim() && entryNum !== null && closeNum !== null ? pipsBetween(symbol, side, entryNum, closeNum) : null;

  async function save() {
    setError(null);
    const posted = wibDateTime(postedAt);
    const closed = wibDateTime(closedAt);
    if (posted === "invalid" || closed === "invalid") {
      setError("Format tanggal: YYYY-MM-DD HH:mm (WIB), contoh 2026-11-19 14:30. Kosongkan untuk sekarang.");
      return;
    }
    setSaving(true);
    try {
      await createSignal(
        {
          symbol: symbol.trim().toUpperCase(),
          side,
          signal_type: signalType,
          entry_price: cleanNum(entry),
          take_profit: cleanNum(tp),
          stop_loss: cleanNum(sl),
          risk_percent: cleanNum(risk),
          notes: notes.trim(),
          status,
          posted_at: posted ?? "",
          closed_at: terminal ? closed ?? "" : "",
          closing_price: needsResult ? cleanNum(closing) : "",
          result_pips: needsResult ? cleanNum(pips) || (suggested !== null ? String(suggested) : "") : "",
        },
        chart
      );
      router.back();
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Posting Sinyal" fallback="/admin/signals" />

      <Card style={{ gap: 14 }}>
        <Field label="Symbol" value={symbol} onChangeText={(v) => setSymbol(v.toUpperCase())} placeholder="XAUUSD" autoCapitalize="characters" />
        <OptionChips label="Arah" options={[{ value: "BUY", label: "BUY" }, { value: "SELL", label: "SELL" }]} value={side} onChange={setSide} />
        <OptionChips
          label="Jenis"
          options={[{ value: "REGULAR", label: "Reguler" }, { value: "NEWS", label: "News" }]}
          value={signalType}
          onChange={setSignalType}
        />
        <View style={styles.row}>
          <Field label="Entry" value={entry} onChangeText={setEntry} keyboardType="decimal-pad" />
          <Field label="Risk %" value={risk} onChangeText={setRisk} keyboardType="decimal-pad" />
        </View>
        <View style={styles.row}>
          <Field label="Take Profit" value={tp} onChangeText={setTp} keyboardType="decimal-pad" />
          <Field label="Stop Loss" value={sl} onChangeText={setSl} keyboardType="decimal-pad" />
        </View>
        <Field label="Catatan / analisa" value={notes} onChangeText={setNotes} multiline autoCapitalize="sentences" />
      </Card>

      <Card style={{ gap: 12 }}>
        <T variant="label" color="textMuted">Foto chart (opsional)</T>
        <Pressable
          onPress={async () => {
            const uri = await pickPhoto().catch(() => null);
            if (uri) setChart(uri);
          }}
          style={[styles.photo, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
        >
          {chart ? (
            <Image source={{ uri: chart }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          ) : (
            <Ionicons name="image-outline" size={26} color={colors.textMuted} />
          )}
        </Pressable>
        {chart && <T variant="caption" color="error" style={{ fontWeight: "700" }} onPress={() => setChart(null)}>Hapus foto</T>}
      </Card>

      <Card style={{ gap: 12 }}>
        <OptionChips
          label="Status awal"
          options={SIGNAL_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
          value={status}
          onChange={setStatus}
        />
        <Field label="Tanggal sinyal (WIB, opsional)" value={postedAt} onChangeText={setPostedAt} placeholder="2026-11-19 14:30" hint="Kosongkan = sekarang. Isi untuk memasukkan sinyal lama." />
        {terminal && (
          <Field label="Tanggal ditutup (WIB, opsional)" value={closedAt} onChangeText={setClosedAt} placeholder="Kosong = sama dengan tanggal sinyal" />
        )}
        {needsResult && (
          <View style={styles.row}>
            <Field label="Harga penutupan" value={closing} onChangeText={setClosing} keyboardType="decimal-pad" placeholder={status === "TP" ? "Kosong = TP" : status === "SL" ? "Kosong = SL" : ""} />
            <Field label="Hasil (pips)" value={pips} onChangeText={setPips} keyboardType="numbers-and-punctuation" placeholder={suggested !== null ? String(suggested) : "0"} />
          </View>
        )}
        {suggested !== null && <T variant="caption" color="textMuted">Hitungan dari harga: {suggested} pips (dipakai kalau kolom pips kosong).</T>}
        {!terminal && <T variant="caption" color="textMuted">Sinyal baru yang masih berjalan otomatis dikirim ke member (push & email).</T>}
      </Card>

      {error && (
        <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
          <T variant="bodySm" color="error">{error}</T>
        </View>
      )}
      <Button title="Posting sinyal" onPress={save} loading={saving} disabled={!symbol.trim() || !entry.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  photo: { height: 150, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  error: { borderRadius: 10, padding: 10 },
});
