import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, SkCard, SkText, Skeleton, T } from "@/components/ui";
import { LinkPageView } from "@/components/LinkPageView";
import { useTheme } from "@/lib/theme";
import { fetchLinkPage, openLinkItem, openSocial, recordLinkPageView, type LinkItem, type LinkPageProfile } from "@/lib/links";

/** Halaman link resmi Loki4x (sama dengan /links di web). */
export default function LinksScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [data, setData] = useState<{ profile: LinkPageProfile; items: LinkItem[] } | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      setData(await fetchLinkPage());
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
    recordLinkPageView();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom }}>
        {data ? (
          <LinkPageView topInset={insets.top + 30} profile={data.profile} items={data.items} onOpen={(i) => openLinkItem(i).catch(() => {})} onSocial={(u) => openSocial(u).catch(() => {})} />
        ) : error ? (
          <View style={{ padding: 24, paddingTop: insets.top + 70, gap: 12, alignItems: "center" }}>
            <T variant="bodySm" color="textMuted" style={{ textAlign: "center" }}>Halaman link belum bisa dimuat. Cek koneksi lalu coba lagi.</T>
            <Button title="Coba lagi" variant="secondary" onPress={load} />
          </View>
        ) : (
          <View style={{ alignItems: "center", padding: 20, paddingTop: insets.top + 58, gap: 10 }}>
            <Skeleton height={96} width={96} radius={48} />
            <SkText variant="h3" width="45%" style={{ alignSelf: "center" }} />
            <SkText variant="bodySm" width="70%" style={{ alignSelf: "center" }} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={40} width={40} radius={20} />
              ))}
            </View>
            <View style={{ alignSelf: "stretch", gap: 12, marginTop: 18 }}>
              <SkCard style={{ padding: 0, overflow: "hidden", gap: 0 }}>
                <Skeleton height={190} radius={0} />
                <View style={{ padding: 14, gap: 4 }}>
                  <SkText variant="body" width="60%" />
                  <SkText variant="bodySm" width="85%" />
                </View>
              </SkCard>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={60} radius={18} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        hitSlop={10}
        style={[styles.back, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.35)" }]}
        accessibilityLabel="Kembali"
      >
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: "absolute", left: 12, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
