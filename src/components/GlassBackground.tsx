import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/lib/theme";

// Latar gradasi lembut untuk gaya glassmorphism: cahaya biru, cyan, ungu, dan hijau di belakang kartu kaca.
const BLOBS = [
  { id: "a", cx: "0%", cy: "4%", rx: "110%", ry: "50%", dark: ["#5F85DB", 0.45], light: ["#5F85DB", 0.32] },
  { id: "b", cx: "105%", cy: "38%", rx: "100%", ry: "45%", dark: ["#06B6D4", 0.28], light: ["#06B6D4", 0.22] },
  { id: "c", cx: "0%", cy: "78%", rx: "110%", ry: "50%", dark: ["#8B5CF6", 0.3], light: ["#A78BFA", 0.28] },
  { id: "d", cx: "100%", cy: "100%", rx: "80%", ry: "36%", dark: ["#10B981", 0.2], light: ["#10B981", 0.18] },
] as const;

/** Hanya tampil di gaya glass. Pasang sebagai anak pertama layar (absolute, tidak menangkap sentuhan). */
export function GlassBackground() {
  const { glass, isDark, colors } = useTheme();
  if (!glass) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <Svg width="100%" height="100%">
        <Defs>
          {BLOBS.map((b) => {
            const [color, opacity] = isDark ? b.dark : b.light;
            return (
              <RadialGradient key={b.id} id={b.id} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fx={b.cx} fy={b.cy} gradientUnits="objectBoundingBox">
                <Stop offset="0" stopColor={color} stopOpacity={opacity} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            );
          })}
        </Defs>
        {BLOBS.map((b) => (
          <Rect key={b.id} x="0" y="0" width="100%" height="100%" fill={`url(#${b.id})`} />
        ))}
      </Svg>
    </View>
  );
}
