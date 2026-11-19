import { useCallback, useState } from "react";
import { Redirect, router, useFocusEffect } from "expo-router";
import { Button, Screen, T } from "@/components/ui";
import { BackHeader, OptionChips } from "@/components/form";
import { SignalCard } from "@/components/SignalCard";
import { useAuth } from "@/lib/auth";
import { fetchSignals } from "@/lib/signals";
import { isTerminalStatus } from "@/shared/signal-metrics";
import type { Signal } from "@/shared/signal-types";

/** Admin: daftar sinyal. Tekan sinyal untuk update status / kirim update / hapus. */
export default function AdminSignals() {
  const { session, profile } = useAuth();
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [filter, setFilter] = useState<"ACTIVE" | "CLOSED">("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSignals(await fetchSignals());
      setError(null);
    } catch {
      setError("Sinyal belum bisa dimuat.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!session) return <Redirect href="/login" />;
  if (!profile?.is_admin) return <Redirect href="/account" />;

  const shown = (signals ?? []).filter((s) => (filter === "ACTIVE" ? !isTerminalStatus(s.status) : isTerminalStatus(s.status))).slice(0, 60);

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Admin · Sinyal" fallback="/admin" />
      <Button title="+ Posting sinyal" onPress={() => router.push("/admin/signal-new")} />
      <OptionChips
        label="Tampilkan"
        options={[
          { value: "ACTIVE", label: "Aktif (pending/running)" },
          { value: "CLOSED", label: "Sudah ditutup" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!signals && !error && <T variant="bodySm" color="textMuted">Memuat…</T>}
      {signals && shown.length === 0 && <T variant="bodySm" color="textMuted">Tidak ada sinyal.</T>}
      {shown.map((s) => (
        <SignalCard key={s.id} signal={s} onPress={() => router.push(`/admin/signal/${s.id}`)} />
      ))}
    </Screen>
  );
}
