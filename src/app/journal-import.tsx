import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader } from "@/components/form";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { friendlyApiError, importRows } from "@/lib/journal";
import { decodeFileBytes, isMt5SummaryReport, parseImportFile, type ParseResult } from "@/shared/trade-import";
import { useI18n } from "@/lib/i18n";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const BATCH = 500;

export default function JournalImportScreen() {
  const { account } = useLocalSearchParams<{ account?: string }>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<{ inserted: number; duplicates: number; invalid: number } | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!hasAccess(profile?.effectiveTier, "MEMBERSHIP")) return <Redirect href="/journal" />;

  async function pick() {
    setError(null);
    setParsed(null);
    setDone(null);
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setFileName(asset.name);
    if ((asset.size ?? 0) > MAX_FILE_BYTES) {
      setError("File terlalu besar (maks 10 MB).");
      return;
    }
    setReading(true);
    try {
      const bytes = new Uint8Array(await new File(asset.uri).arrayBuffer());
      const text = decodeFileBytes(bytes);
      if (isMt5SummaryReport(text)) {
        setError(
          "File ini laporan statistik dari menu Reports MT5, isinya hanya ringkasan tanpa daftar trade. Gunakan laporan History: Toolbox → History → klik kanan → Positions → Report → HTML."
        );
        return;
      }
      const result = parseImportFile(text);
      if (result.rows.length === 0) {
        setError("Tidak ada trade yang bisa dibaca. Pastikan file adalah statement MT4/MT5 (HTML) atau CSV dengan kolom symbol, side/type, dan entry/open price.");
        return;
      }
      setParsed(result);
    } catch {
      setError("File tidak bisa dibaca. Coba pilih ulang filenya.");
    } finally {
      setReading(false);
    }
  }

  async function runImport() {
    if (!parsed || !account) return;
    setError(null);
    const total = { inserted: 0, duplicates: 0, invalid: 0 };
    try {
      for (let i = 0; i < parsed.rows.length; i += BATCH) {
        setProgress(Math.round((i / parsed.rows.length) * 100));
        const res = await importRows(String(account), parsed.rows.slice(i, i + BATCH));
        total.inserted += res.inserted;
        total.duplicates += res.duplicates;
        total.invalid += res.invalid;
      }
      setDone(total);
    } catch (err) {
      setError(friendlyApiError(err));
      if (total.inserted > 0) setDone(total);
    } finally {
      setProgress(null);
    }
  }

  const closed = parsed?.rows.filter((r) => r.pnl !== null) ?? [];
  const totalPnl = closed.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const dates = parsed?.rows.map((r) => r.trade_date).sort() ?? [];

  return (
    <Screen>
      <BackHeader title="Import Trade" fallback="/journal" />

      {done ? (
        <Card style={{ alignItems: "center", paddingVertical: 24 }}>
          <Ionicons name="checkmark-circle" size={44} color={colors.success} />
          <T variant="h3">{done.inserted} trade berhasil di-import</T>
          {(done.duplicates > 0 || done.invalid > 0) && (
            <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
              {done.duplicates > 0 ? `${t("{n} sudah pernah di-import (dilewati).", { n: done.duplicates })} ` : ""}
              {done.invalid > 0 ? t("{n} baris tidak valid (dilewati).", { n: done.invalid }) : ""}
            </T>
          )}
          <Button title="Selesai" onPress={() => router.back()} style={{ alignSelf: "stretch", marginTop: 8 }} />
        </Card>
      ) : (
        <>
          <Card>
            <T variant="label" color="textMuted">Cara ambil file dari MT4 / MT5 (di PC)</T>
            <T variant="bodySm" color="textSecondary">
              <T variant="bodySm" style={{ fontWeight: "700" }}>MT4:</T> Terminal → Account History → klik kanan → All History → Save as Detailed Report.
            </T>
            <T variant="bodySm" color="textSecondary">
              <T variant="bodySm" style={{ fontWeight: "700" }}>MT5:</T> Toolbox → History → klik kanan → Positions → Report → HTML (bukan menu Reports).
            </T>
            <T variant="bodySm" color="textSecondary">
              <T variant="bodySm" style={{ fontWeight: "700" }}>CSV:</T> minimal kolom symbol, side/type, entry/open price. File Export CSV dari web juga bisa.
            </T>
            <T variant="caption" color="textMuted">Kirim filenya ke HP (mis. lewat Telegram/Drive), lalu pilih di sini. Trade yang sama tidak akan masuk dua kali.</T>
          </Card>

          <Button title={reading ? t("Membaca file…") : fileName ? t("Ganti file ({name})", { name: fileName }) : "Pilih file statement"} variant="secondary" onPress={pick} loading={reading} />

          {error && (
            <View style={[styles.error, { backgroundColor: colors.errorSubtle }]}>
              <T variant="bodySm" color="error">{error}</T>
            </View>
          )}

          {parsed && (
            <>
              <Card style={styles.stats}>
                {[
                  { label: "Format", value: parsed.format ?? "-" },
                  { label: "Jumlah trade", value: String(parsed.rows.length) },
                  { label: "Periode", value: dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : "-" },
                  { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}` },
                ].map((s) => (
                  <View key={s.label} style={styles.stat}>
                    <T variant="caption" color="textMuted">{s.label}</T>
                    <T variant="bodySm" style={{ fontWeight: "700" }}>{s.value}</T>
                  </View>
                ))}
              </Card>
              {parsed.skipped > 0 && <T variant="caption" color="warning">{parsed.skipped} baris tidak bisa dibaca dan dilewati.</T>}

              <Card style={{ gap: 0, paddingVertical: 6 }}>
                {parsed.rows.slice(0, 8).map((r, i) => (
                  <View key={i} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <T variant="caption" color="textMuted" style={{ width: 78 }}>{r.trade_date}</T>
                    <T variant="bodySm" style={{ fontWeight: "700", flex: 1 }}>{r.symbol}</T>
                    <T variant="caption" style={{ color: r.side === "BUY" ? colors.success : colors.error, width: 34 }}>{r.side}</T>
                    <T variant="bodySm" style={{ width: 80, textAlign: "right", fontWeight: "700", color: (r.pnl ?? 0) >= 0 ? colors.success : colors.error }}>
                      {r.pnl === null ? "-" : `${r.pnl >= 0 ? "+" : ""}${r.pnl.toFixed(2)}`}
                    </T>
                  </View>
                ))}
                {parsed.rows.length > 8 && (
                  <T variant="caption" color="textMuted" style={{ paddingVertical: 8 }}>+{parsed.rows.length - 8} trade lainnya</T>
                )}
              </Card>

              <Button
                title={progress !== null ? t("Mengimport… {p}%", { p: progress }) : t("Import {n} trade", { n: parsed.rows.length })}
                onPress={runImport}
                loading={progress !== null}
                disabled={!account}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { borderRadius: 10, padding: 10 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { flexBasis: "45%", flexGrow: 1, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
});
