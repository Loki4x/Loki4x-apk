import { Image, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/components/ui";
import { SOCIALS, type LinkItem, type LinkPageProfile, type LinkTheme } from "@/lib/links";

type IconName = keyof typeof Ionicons.glyphMap;

// Warna tiap tema tetap (sama dengan /links di web), tidak ikut tema terang/gelap aplikasi.
const THEMES: Record<
  LinkTheme,
  { bg: string; text: string; muted: string; card: string; cardBorder: string; cardText: string; header: string; social: string; socialBorder: string; ring: string }
> = {
  dark: { bg: "#050810", text: "#FFFFFF", muted: "#94A3B8", card: "#0D1321", cardBorder: "#1B2337", cardText: "#FFFFFF", header: "#94A3B8", social: "#0D1321", socialBorder: "#1B2337", ring: "#1B2337" },
  light: { bg: "#F4F6FB", text: "#1C1F26", muted: "#545B68", card: "#FFFFFF", cardBorder: "#E1E5EC", cardText: "#1C1F26", header: "#7C8494", social: "#FFFFFF", socialBorder: "#E1E5EC", ring: "#FFFFFF" },
  glass: { bg: "#070B16", text: "#FFFFFF", muted: "#CBD5E1", card: "rgba(255,255,255,0.08)", cardBorder: "rgba(255,255,255,0.16)", cardText: "#FFFFFF", header: "#CBD5E1", social: "rgba(255,255,255,0.08)", socialBorder: "rgba(255,255,255,0.16)", ring: "rgba(255,255,255,0.2)" },
  brand: { bg: "#3F62C4", text: "#FFFFFF", muted: "#DBEAFE", card: "#FFFFFF", cardBorder: "#FFFFFF", cardText: "#13244F", header: "#DBEAFE", social: "rgba(255,255,255,0.15)", socialBorder: "rgba(255,255,255,0.25)", ring: "rgba(255,255,255,0.4)" },
};

function Backdrop({ theme }: { theme: LinkTheme }) {
  if (theme === "glass") {
    return (
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="a" cx="15%" cy="4%" rx="70%" ry="40%">
            <Stop offset="0" stopColor="#5F85DB" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#5F85DB" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="b" cx="100%" cy="38%" rx="60%" ry="35%">
            <Stop offset="0" stopColor="#06B6D4" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#06B6D4" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="c" cx="5%" cy="85%" rx="70%" ry="40%">
            <Stop offset="0" stopColor="#8B5CF6" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#8B5CF6" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#a)" />
        <Rect width="100%" height="100%" fill="url(#b)" />
        <Rect width="100%" height="100%" fill="url(#c)" />
      </Svg>
    );
  }
  if (theme === "brand") {
    return (
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E3A8A" />
            <Stop offset="0.5" stopColor="#3F62C4" />
            <Stop offset="1" stopColor="#0E7490" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
    );
  }
  return null;
}

/** Isi halaman link (profil, sosmed, daftar link). Dipakai di layar /links dan pratinjau admin. */
export function LinkPageView({
  profile,
  items,
  onOpen,
  onSocial,
  topInset = 0,
}: {
  profile: LinkPageProfile;
  items: LinkItem[];
  onOpen: (item: LinkItem) => void;
  onSocial: (url: string) => void;
  /** Jarak tambahan di atas (status bar), supaya warna tema penuh sampai ke atas layar. */
  topInset?: number;
}) {
  const th = THEMES[profile.theme] ?? THEMES.dark;
  const socials = SOCIALS.filter((s) => profile.socials?.[s.key]);

  return (
    <View style={[styles.page, { backgroundColor: th.bg }]}>
      <Backdrop theme={profile.theme} />
      <View style={[styles.inner, { paddingTop: 28 + topInset }]}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={[styles.avatar, { borderColor: th.ring }]} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { borderColor: th.ring }]}>
            <T style={{ color: "#FFFFFF", fontSize: 32, fontWeight: "800" }}>{(profile.display_name || "L").charAt(0).toUpperCase()}</T>
          </View>
        )}
        <T style={{ color: th.text, fontSize: 20, fontWeight: "800", textAlign: "center", marginTop: 14 }}>{profile.display_name}</T>
        {profile.bio ? <T style={{ color: th.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 6 }}>{profile.bio}</T> : null}

        {socials.length > 0 && (
          <View style={styles.socials}>
            {socials.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => onSocial(profile.socials[s.key]!)}
                accessibilityLabel={s.label}
                style={({ pressed }) => [styles.social, { backgroundColor: th.social, borderColor: th.socialBorder, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name={s.icon as IconName} size={18} color={th.text} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ alignSelf: "stretch", gap: 12, marginTop: 26 }}>
          {items.length === 0 && <T style={{ color: th.muted, textAlign: "center" }}>Belum ada link.</T>}
          {items.map((item) =>
            item.kind === "HEADER" ? (
              <T key={item.id} style={{ color: th.header, fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textAlign: "center", marginTop: 10, textTransform: "uppercase" }}>
                {item.title}
              </T>
            ) : item.featured && item.image_url ? (
              <Pressable
                key={item.id}
                onPress={() => onOpen(item)}
                style={({ pressed }) => [styles.featured, { backgroundColor: th.card, borderColor: th.cardBorder, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <Image source={{ uri: item.image_url }} style={styles.featuredImage} resizeMode="cover" />
                <View style={styles.featuredBody}>
                  <View style={{ flex: 1 }}>
                    <T style={{ color: th.cardText, fontWeight: "700" }}>{item.title}</T>
                    {item.description ? <T style={{ color: th.cardText, opacity: 0.75, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{item.description}</T> : null}
                  </View>
                  <Ionicons name="arrow-up-outline" size={18} color={th.cardText} style={{ opacity: 0.6, transform: [{ rotate: "45deg" }] }} />
                </View>
              </Pressable>
            ) : (
              <Pressable
                key={item.id}
                onPress={() => onOpen(item)}
                style={({ pressed }) => [styles.button, { backgroundColor: th.card, borderColor: th.cardBorder, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} /> : <View style={styles.thumbSpace} />}
                <View style={{ flex: 1, alignItems: "center" }}>
                  <T style={{ color: th.cardText, fontWeight: "700", textAlign: "center" }}>{item.title}</T>
                  {item.description ? <T style={{ color: th.cardText, opacity: 0.7, fontSize: 12, textAlign: "center", marginTop: 1 }} numberOfLines={1}>{item.description}</T> : null}
                </View>
                <View style={[styles.thumbSpace, { alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="arrow-up-outline" size={16} color={th.cardText} style={{ opacity: 0.5, transform: [{ rotate: "45deg" }] }} />
                </View>
              </Pressable>
            )
          )}
        </View>
        <T style={{ color: th.muted, fontSize: 12, fontWeight: "700", opacity: 0.7, marginTop: 30 }}>Loki4x Academy</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, overflow: "hidden" },
  inner: { alignItems: "center", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40, width: "100%", maxWidth: 560, alignSelf: "center" },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4 },
  avatarFallback: { backgroundColor: "#5F85DB", alignItems: "center", justifyContent: "center" },
  socials: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 18 },
  social: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  button: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  thumb: { width: 44, height: 44, borderRadius: 12 },
  thumbSpace: { width: 44, height: 44 },
  featured: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  featuredImage: { width: "100%", aspectRatio: 16 / 9 },
  featuredBody: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
});
