import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Badge, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, OptionChips } from "@/components/form";
import { Locked } from "@/components/Locked";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { friendlyApiError } from "@/lib/journal";
import { fetchPositioning, type RetailBiasItem } from "@/lib/market";
import { categorizeSymbol, getContrarianSignal, SIGNAL_LABEL, type AssetCategory, type ContrarianSignal } from "@/shared/asset-category";

type Filter = "ALL" | AssetCategory;
type Sort = "LONG" | "SHORT" | "AZ";
const SIGNAL_TONE: Record<ContrarianSignal, "error" | "muted" | "success"> = { BEARISH: "error", NEUTRAL: "muted", BULLISH: "success" };

/** Retail Bias: sentimen trader retail (long vs short), dibaca kontrarian. Sama dengan /positioning di web. */
export default function PositioningScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [items, setItems] = useState<RetailBiasItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("LONG");
  const [refreshing, setRefreshing] = useState(false);
  const allowed = hasAccess(profile?.effectiveTier, "VIP");

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setItems(await fetchPositioning());
      setError(null);
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      if (!items) load();
    }, [load, items])
  );

  const list = useMemo(() => {
    const enriched = (items ?? []).map((p) => ({ ...p, category: categorizeSymbol(p.symbol), signal: getContrarianSignal(p.long_percent) }));
    const filtered = filter === "ALL" ? enriched : enriched.filter((i) => i.category === filter);
    filtered.sort((a, b) =>
      sort === "LONG" ? b.long_percent - a.long_percent : sort === "SHORT" ? b.short_percent - a.short_percent : a.symbol.localeCompare(b.symbol)
    );
    return filtered;
  }, [items, filter, sort]);

  if (!session) return <Redirect href="/login" />;
  if (!allowed) {
    return (
      <Screen>
        <BackHeader title="Retail Bias" />
        <Locked tier="VIP" description="Sentimen retail (long vs short) — dibaca kontrarian." />
      </Screen>
    );
  }

  const counts = { BEARISH: 0, NEUTRAL: 0, BULLISH: 0 } as Record<ContrarianSignal, number>;
  for (const i of items ?? []) counts[getContrarianSignal(i.long_percent)]++;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Retail Bias" />
      <T variant="bodySm" color="textSecondary">
        Sentimen retail (long vs short) — dibaca kontrarian. Mayoritas long dibaca bearish, mayoritas short dibaca bullish.
      </T>
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!items && !error && <SkeletonPage variant="list" count={4} />}
      {items && items.length === 0 && <T variant="bodySm" color="textMuted">Belum ada data positioning.</T>}

      {items && items.length > 0 && (
        <>
          <View style={styles.counts}>
            {(["BEARISH", "NEUTRAL", "BULLISH"] as ContrarianSignal[]).map((s) => (
              <Card key={s} style={styles.count}>
                <T variant="h3">{counts[s]}</T>
                <Badge label={SIGNAL_LABEL[s]} tone={SIGNAL_TONE[s]} />
              </Card>
            ))}
          </View>
          <OptionChips
            label="Kategori"
            options={[
              { value: "ALL", label: "Semua" },
              { value: "CURRENCY", label: "Currency" },
              { value: "COMMODITY", label: "Commodity" },
              { value: "INDEX", label: "Index" },
              { value: "CRYPTO", label: "Crypto" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <OptionChips
            label="Urutkan"
            options={[
              { value: "LONG", label: "Paling Long" },
              { value: "SHORT", label: "Paling Short" },
              { value: "AZ", label: "A–Z" },
            ]}
            value={sort}
            onChange={setSort}
          />
        </>
      )}

      {list.map((i) => (
        <Card key={i.symbol} style={{ gap: 8 }}>
          <View style={styles.between}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <T variant="h3">{i.symbol}</T>
              {i.source === "auto" && <Badge label="Live" tone="success" />}
            </View>
            <Badge label={SIGNAL_LABEL[i.signal]} tone={SIGNAL_TONE[i.signal]} />
          </View>
          <View style={[styles.bar, { backgroundColor: colors.errorSubtle }]}>
            <View style={{ width: `${i.long_percent}%`, backgroundColor: colors.success, borderRadius: 99 }} />
          </View>
          <View style={styles.between}>
            <T variant="caption" color="success">Long {i.long_percent.toFixed(0)}%</T>
            <T variant="caption" color="error">Short {i.short_percent.toFixed(0)}%</T>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: "row", gap: 8 },
  count: { flex: 1, padding: 10, alignItems: "center", gap: 4 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bar: { height: 10, borderRadius: 99, overflow: "hidden", flexDirection: "row" },
});
