import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";

// Warna sama dengan web (app/globals.css + tailwind.config.ts).
const dark = {
  background: "#050810",
  surface: "#0D1321",
  surface2: "#151C2E",
  surfaceHover: "#1B2337",
  border: "#1B2337",
  borderStrong: "#2D3D62",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
};

const light: typeof dark = {
  background: "#F7F9FC",
  surface: "#FFFFFF",
  surface2: "#EEF1F6",
  surfaceHover: "#E3E8F0",
  border: "#E1E5EC",
  borderStrong: "#C7CEDA",
  text: "#1C1F26",
  textSecondary: "#545B68",
  textMuted: "#7C8494",
};

const accents = {
  primary: "#5F85DB",
  primarySubtle: "rgba(95, 133, 219, 0.15)",
  success: "#10B981",
  successSubtle: "rgba(16, 185, 129, 0.15)",
  error: "#EF4444",
  errorSubtle: "rgba(239, 68, 68, 0.15)",
  warning: "#F59E0B",
  warningSubtle: "rgba(245, 158, 11, 0.15)",
  secondary: "#06B6D4",
};

// Gaya glassmorphism: kartu & permukaan jadi kaca transparan di atas latar gradasi (lihat GlassBackground).
const darkGlass: typeof dark = {
  ...dark,
  surface: "rgba(22, 30, 50, 0.55)",
  surface2: "rgba(255, 255, 255, 0.06)",
  surfaceHover: "rgba(255, 255, 255, 0.10)",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.18)",
};

const lightGlass: typeof dark = {
  ...light,
  background: "#EEF2FA",
  surface: "rgba(255, 255, 255, 0.62)",
  surface2: "rgba(255, 255, 255, 0.55)",
  surfaceHover: "rgba(255, 255, 255, 0.75)",
  border: "rgba(255, 255, 255, 0.90)",
  borderStrong: "rgba(199, 206, 218, 0.9)",
};

export type ThemeColors = typeof dark & typeof accents;
export type ThemeMode = "system" | "dark" | "light";
/** normal = tampilan solid seperti web; glass = glassmorphism. */
export type ThemeStyle = "normal" | "glass";

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  style: ThemeStyle;
  glass: boolean;
  setStyle: (style: ThemeStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "loki4x-theme";
const STYLE_KEY = "loki4x-theme-style";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [style, setStyleState] = useState<ThemeStyle>("normal");

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (v === "dark" || v === "light" || v === "system") setModeState(v);
      })
      .catch(() => {});
    SecureStore.getItemAsync(STYLE_KEY)
      .then((v) => {
        if (v === "normal" || v === "glass") setStyleState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    // Default web = gelap, jadi kalau sistem tidak memberi info, pakai gelap.
    const isDark = mode === "system" ? system !== "light" : mode === "dark";
    const glass = style === "glass";
    const base = glass ? (isDark ? darkGlass : lightGlass) : isDark ? dark : light;
    return {
      colors: { ...base, ...accents },
      isDark,
      mode,
      setMode: (m) => {
        setModeState(m);
        SecureStore.setItemAsync(STORAGE_KEY, m).catch(() => {});
      },
      style,
      glass,
      setStyle: (st) => {
        setStyleState(st);
        SecureStore.setItemAsync(STYLE_KEY, st).catch(() => {});
      },
    };
  }, [mode, system, style]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
