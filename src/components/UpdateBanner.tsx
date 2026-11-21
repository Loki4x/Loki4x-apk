import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Linking, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { checkForUpdate, cleanupOldApks, downloadAndInstall, onManualCheck, type LatestRelease } from "@/lib/app-update";

type Phase = "available" | "downloading" | "installing" | "error";
const RECHECK_MS = 60 * 60 * 1000;

/**
 * Banner update di atas layar (bisa ditutup, tidak wajib). Tekan "Update" → APK diunduh di dalam
 * aplikasi dengan progress, lalu layar install Android terbuka otomatis.
 */
export function UpdateBanner() {
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [phase, setPhase] = useState<Phase>("available");
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);
  const lastCheck = useRef(0);
  const slide = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const check = async () => {
      if (dismissed.current || Date.now() - lastCheck.current < RECHECK_MS) return;
      lastCheck.current = Date.now();
      const r = await checkForUpdate();
      if (r) {
        setRelease(r);
        setPhase("available");
        setVisible(true);
      } else {
        cleanupOldApks();
      }
    };
    const timer = setTimeout(check, 1500);
    const off = onManualCheck(async () => {
      lastCheck.current = Date.now();
      const r = await checkForUpdate();
      if (r) {
        dismissed.current = false;
        setRelease(r);
        setPhase("available");
        setVisible(true);
      }
      return !!r;
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
      off();
    };
  }, []);

  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, friction: 8, tension: 70 }).start();
  }, [visible, slide]);

  useEffect(() => {
    Animated.timing(bar, { toValue: progress, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [progress, bar]);

  if (!release) return null;

  const close = () => {
    dismissed.current = true;
    setVisible(false);
  };

  async function start() {
    if (!release) return;
    setPhase("downloading");
    setProgress(0);
    try {
      await downloadAndInstall(release, setProgress);
      setPhase("installing");
    } catch {
      setPhase("error");
    }
  }

  const accent = phase === "error" ? colors.error : colors.primary;
  const title =
    phase === "downloading"
      ? t("Mengunduh pembaruan…")
      : phase === "installing"
        ? t("Siap dipasang")
        : phase === "error"
          ? t("Unduhan gagal")
          : t("Update tersedia");
  const subtitle =
    phase === "downloading"
      ? `${Math.round(progress * 100)}% · v${release.version}`
      : phase === "installing"
        ? t("Tekan “Update” di layar install Android.")
        : phase === "error"
          ? t("Cek koneksi lalu coba lagi.")
          : t("v{version} siap diunduh.", { version: release.version });

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) }],
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? "rgba(13, 19, 33, 0.97)" : "rgba(255, 255, 255, 0.98)",
            borderColor: accent,
            shadowColor: accent,
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: isDark ? "rgba(95,133,219,0.16)" : colors.primarySubtle }]}>
          <Ionicons
            name={phase === "error" ? "alert-circle-outline" : phase === "installing" ? "checkmark-circle-outline" : "cloud-download-outline"}
            size={22}
            color={accent}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodySm" style={{ fontWeight: "800", letterSpacing: 0.4, color: accent }}>{title.toUpperCase()}</T>
          <T variant="caption" color="textSecondary" numberOfLines={2}>{subtitle}</T>
          {phase === "available" && release.notes ? (
            <T variant="caption" color="textMuted" numberOfLines={2}>{release.notes}</T>
          ) : null}
          {phase === "downloading" && (
            <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
              <Animated.View
                style={{ height: "100%", borderRadius: 99, backgroundColor: colors.primary, width: bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}
              />
            </View>
          )}
        </View>

        {phase === "available" && (
          <Pressable onPress={start} hitSlop={6} style={[styles.action, { backgroundColor: colors.primary }]}>
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <T variant="caption" style={{ color: "#FFFFFF", fontWeight: "800" }}>Update</T>
          </Pressable>
        )}
        {(phase === "error" || phase === "installing") && (
          <Pressable
            onPress={phase === "error" ? start : () => downloadAndInstall(release, () => {}).catch(() => Linking.openURL(release.apkUrl))}
            hitSlop={6}
            style={[styles.action, { backgroundColor: accent }]}
          >
            <Ionicons name={phase === "error" ? "refresh" : "open-outline"} size={16} color="#FFFFFF" />
            <T variant="caption" style={{ color: "#FFFFFF", fontWeight: "800" }}>{phase === "error" ? t("Ulangi") : t("Pasang")}</T>
          </Pressable>
        )}
        {phase !== "downloading" && (
          <Pressable onPress={close} hitSlop={10} style={styles.close} accessibilityLabel={t("Tutup")}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 1000, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 520,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  track: { height: 6, borderRadius: 99, overflow: "hidden", marginTop: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  close: { padding: 4 },
});
