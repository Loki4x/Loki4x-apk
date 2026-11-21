import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { Card, Screen, T } from "@/components/ui";
import { NewsCardsSkeleton } from "@/components/Skeletons";
import { BackHeader, OptionChips } from "@/components/form";
import { Locked } from "@/components/Locked";
import { hasAccess, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { daysAgo, formatDateTimeWib } from "@/lib/format";
import { friendlyApiError } from "@/lib/journal";
import { fetchMarketNews, type MarketNewsItem } from "@/lib/market";

type Filter = "ALL" | MarketNewsItem["categories"][number];

/** Fundamental Pasar: berita Investing.com (sama dengan /market-news di web). */
export default function MarketNewsScreen() {
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const [news, setNews] = useState<MarketNewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const allowed = hasAccess(profile?.effectiveTier, "MEMBERSHIP");

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      setNews(await fetchMarketNews());
      setError(null);
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, [allowed]);

  useFocusEffect(
    useCallback(() => {
      if (!news) load();
    }, [load, news])
  );

  if (!session) return <Redirect href="/login" />;
  if (!allowed) {
    return (
      <Screen>
        <BackHeader title="Fundamental Pasar" />
        <Locked tier="MEMBERSHIP" description="Berita dari Investing.com, diperbarui otomatis setiap ada berita baru." />
      </Screen>
    );
  }

  const shown = (news ?? []).filter((n) => filter === "ALL" || n.categories.includes(filter));

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <BackHeader title="Fundamental Pasar" />
      <T variant="bodySm" color="textSecondary">Berita dari Investing.com, diperbarui otomatis setiap ada berita baru.</T>
      <OptionChips
        label="Kategori"
        options={[
          { value: "ALL", label: "Semua" },
          { value: "FOREX", label: "Forex" },
          { value: "GOLD", label: "Gold" },
          { value: "COMMODITIES", label: "Commodities" },
          { value: "STOCKS", label: "Stocks" },
          { value: "CRYPTO", label: "Crypto" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error && <T variant="bodySm" color="error">{error}</T>}
      {!news && !error && <NewsCardsSkeleton />}
      {news && shown.length === 0 && <T variant="bodySm" color="textMuted">Belum ada berita untuk kategori ini.</T>}
      {shown.slice(0, 80).map((n) => (
        <Pressable key={n.id} onPress={() => WebBrowser.openBrowserAsync(n.link)}>
          {({ pressed }) => (
            <Card style={{ gap: 6, opacity: pressed ? 0.85 : 1 }}>
              <T variant="body" style={{ fontWeight: "700" }}>{n.title}</T>
              {n.summary ? <T variant="caption" color="textSecondary" numberOfLines={3}>{n.summary}</T> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <T variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {n.source} · {formatDateTimeWib(n.publishedAt)} WIB · {daysAgo(n.publishedAt)}
                </T>
                <Ionicons name="open-outline" size={14} color={colors.textMuted} />
              </View>
            </Card>
          )}
        </Pressable>
      ))}
    </Screen>
  );
}
