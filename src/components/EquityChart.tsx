import { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop } from "react-native-svg";
import { T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { formatMoney, type Currency } from "@/lib/format";

const HEIGHT = 150;

/** Kurva saldo (equity) dari trade tertutup, sama dengan grafik Equity di dashboard web. */
export function EquityChart({ data, currency }: { data: { date: string; balance: number }[]; currency: Currency }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [width, setWidth] = useState(0);
  const values = data.map((d) => d.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, Math.abs(max) * 0.01);
  const up = values[values.length - 1] >= values[0];
  const color = up ? colors.success : colors.error;

  const pad = 6;
  // Satu titik saja (belum ada trade tertutup): gambar garis datar selebar grafik.
  const series = values.length === 1 ? [values[0], values[0]] : values;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = pad + (1 - (v - min) / span) * (HEIGHT - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${HEIGHT} L${pts[0][0].toFixed(1)},${HEIGHT} Z` : "";

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T variant="caption" color="textMuted">{formatMoney(max, currency)}</T>
        <T variant="caption" color="textMuted">{data.length} {t("titik")}</T>
      </View>
      <View style={{ height: HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line key={f} x1={0} x2={width} y1={HEIGHT * f} y2={HEIGHT * f} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
            ))}
            {pts.length > 1 && <Path d={area} fill="url(#eq)" />}
            {pts.length > 1 && <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T variant="caption" color="textMuted">{data[0]?.date ?? ""}</T>
        <T variant="caption" color="textMuted">{formatMoney(min, currency)}</T>
        <T variant="caption" color="textMuted">{data[data.length - 1]?.date ?? ""}</T>
      </View>
    </View>
  );
}
