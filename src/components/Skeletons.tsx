import { View } from "react-native";
import { SkCard, SkText, Skeleton } from "@/components/ui";
import { useTheme } from "@/lib/theme";

// Kerangka loading per jenis konten. Ukuran, padding, dan jarak disamakan dengan komponen aslinya
// supaya saat data selesai dimuat, isi langsung menempati posisi yang sama (tidak "lompat").

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Kartu berita (Fundamental Pasar): judul 2 baris, ringkasan, baris info. */
export function NewsCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {range(count).map((i) => (
        <SkCard key={i} style={{ gap: 6 }}>
          <SkText variant="body" width="95%" />
          <SkText variant="body" width="60%" />
          <SkText variant="caption" width="100%" />
          <SkText variant="caption" width="80%" />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <SkText variant="caption" width="45%" />
          </View>
        </SkCard>
      ))}
    </>
  );
}

/** Kalender ekonomi: kartu per hari berisi baris jam · dampak · mata uang · judul. */
export function CalendarSkeleton({ days = 2, rows = 4 }: { days?: number; rows?: number }) {
  return (
    <>
      {range(days).map((d) => (
        <SkCard key={d} style={{ gap: 0, paddingVertical: 8 }}>
          <SkText variant="label" width="35%" style={{ marginVertical: 9 }} />
          {range(rows).map((r) => (
            <View key={r} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 9 }}>
              <SkText variant="caption" width={40} />
              <Skeleton height={8} width={8} radius={4} style={{ marginTop: 4 }} />
              <SkText variant="caption" width={32} />
              <View style={{ flex: 1 }}>
                <SkText variant="bodySm" width="80%" />
                <SkText variant="caption" width="50%" />
              </View>
            </View>
          ))}
        </SkCard>
      ))}
    </>
  );
}

/** Deretan kartu statistik kecil (label + angka besar), mis. COT, Referral, Retail Bias. */
export function StatRowSkeleton({ count = 3, center }: { count?: number; center?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {range(count).map((i) => (
        <SkCard key={i} style={{ flex: 1, padding: 12, gap: 2, alignItems: center ? "center" : "stretch" }}>
          <SkText variant="caption" width="70%" />
          <SkText variant="h3" width="55%" />
          {!center && <SkText variant="caption" width="45%" />}
        </SkCard>
      ))}
    </View>
  );
}

/** Kartu dengan bar long/short (COT, Retail Bias). */
export function BarCardsSkeleton({ count = 4, barHeight = 10 }: { count?: number; barHeight?: number }) {
  return (
    <>
      {range(count).map((i) => (
        <SkCard key={i} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <SkText variant="h3" width="35%" />
            <Skeleton height={20} width={70} radius={999} />
          </View>
          <Skeleton height={barHeight} radius={99} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <SkText variant="caption" width="30%" />
            <SkText variant="caption" width="30%" />
          </View>
          <SkText variant="caption" width="55%" />
        </SkCard>
      ))}
    </>
  );
}

/** Daftar baris dengan ikon bulat (Notifikasi, Live Chat admin). */
export function IconRowsSkeleton({ count = 5, icon = 36 }: { count?: number; icon?: number }) {
  return (
    <>
      {range(count).map((i) => (
        <SkCard key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {icon > 0 && <Skeleton height={icon} width={icon} radius={icon / 2} />}
          <View style={{ flex: 1, gap: 3 }}>
            <SkText variant="bodySm" width="65%" />
            <SkText variant="caption" width="95%" />
            <SkText variant="caption" width="40%" />
          </View>
        </SkCard>
      ))}
    </>
  );
}

/** Kartu kategori Akademi: ikon, judul, subjudul, progres, badge kuis. */
export function AcademySkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <SkCard>
        <SkText variant="label" width="40%" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, gap: 2 }}>
              <SkText variant="h2" width="45%" />
              <SkText variant="caption" width="80%" />
            </View>
          ))}
        </View>
        <Skeleton height={8} radius={99} />
      </SkCard>
      {range(count).map((i) => (
        <SkCard key={i}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Skeleton height={44} width={44} radius={22} />
            <View style={{ flex: 1, gap: 2 }}>
              <SkText variant="h3" width="50%" />
              <SkText variant="caption" width="85%" />
            </View>
          </View>
          <Skeleton height={8} radius={99} />
          <SkText variant="caption" width="35%" />
          <Skeleton height={20} width={150} radius={999} />
        </SkCard>
      ))}
    </>
  );
}

/** Kartu video (thumbnail 16:9 + judul). */
export function VideoCardsSkeleton({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <>
      {range(count).map((i) => (
        <SkCard key={i} style={{ padding: 0, overflow: "hidden", gap: 0 }}>
          <View style={{ aspectRatio: 16 / 9, width: "100%", backgroundColor: colors.surface2 }}>
            <Skeleton fill radius={0} />
          </View>
          <View style={{ padding: 14, gap: 4 }}>
            <SkText variant="body" width="80%" />
            <SkText variant="caption" width="60%" />
          </View>
        </SkCard>
      ))}
    </>
  );
}

/** Gelembung chat bergantian kiri-kanan (Komunitas, Chat Admin). */
export function ChatSkeleton({ count = 5 }: { count?: number }) {
  const { colors } = useTheme();
  const widths = [62, 48, 70, 40, 55, 66];
  return (
    <View style={{ gap: 10 }}>
      {range(count).map((i) => {
        const mine = i % 3 === 1;
        return (
          <View key={i} style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
            <View
              style={{
                width: `${widths[i % widths.length]}%`,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 8,
                gap: 4,
              }}
            >
              {!mine && <SkText variant="caption" width="40%" />}
              <SkText variant="bodySm" width="95%" />
              {i % 2 === 0 && <SkText variant="bodySm" width="60%" />}
              <SkText variant="caption" width={60} style={{ alignSelf: "flex-end" }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Halaman Upgrade: kartu tier sekarang + kartu paket (nama, harga, fitur, tombol). */
export function UpgradeSkeleton() {
  return (
    <>
      <SkCard>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SkText variant="bodySm" width="35%" />
          <Skeleton height={20} width={60} radius={999} />
        </View>
        <SkText variant="caption" width="45%" />
      </SkCard>
      <SkText variant="label" width="40%" />
      {[0, 1].map((i) => (
        <SkCard key={i}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <SkText variant="h3" width="40%" />
            <Skeleton height={20} width={70} radius={999} />
          </View>
          <SkText variant="h1" width="50%" />
          {range(4).map((f) => (
            <View key={f} style={{ flexDirection: "row", gap: 8 }}>
              <Skeleton height={16} width={16} radius={8} />
              <SkText variant="bodySm" width="75%" />
            </View>
          ))}
          <Skeleton height={48} radius={999} />
          <SkText variant="caption" width="50%" style={{ alignSelf: "center" }} />
        </SkCard>
      ))}
    </>
  );
}

/** Halaman Referral: kartu link, saldo hari, statistik, cara kerja. */
export function ReferralSkeleton() {
  return (
    <>
      <SkCard>
        <SkText variant="label" width="40%" />
        <SkText variant="body" width="90%" />
        <SkText variant="caption" width="30%" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton height={48} radius={999} style={{ flex: 1 }} />
          <Skeleton height={48} radius={999} style={{ flex: 1 }} />
        </View>
      </SkCard>
      <SkCard>
        <SkText variant="label" width="35%" />
        <SkText variant="h2" width="30%" />
        <Skeleton height={8} radius={99} />
        <Skeleton height={48} radius={999} />
      </SkCard>
      <StatRowSkeleton count={3} />
    </>
  );
}

/** Detail sinyal / trade: kartu header + kotak level + kartu isi. */
export function DetailSkeleton() {
  const { colors } = useTheme();
  return (
    <>
      <SkCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Skeleton height={22} width={44} radius={8} />
          <SkText variant="h2" width="40%" />
          <View style={{ flex: 1 }} />
          <Skeleton height={20} width={64} radius={999} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, borderRadius: 10, padding: 8, gap: 2, backgroundColor: colors.surface2 }}>
              <SkText variant="caption" width="45%" />
              <SkText variant="bodySm" width="75%" />
            </View>
          ))}
        </View>
        <SkText variant="caption" width="45%" />
      </SkCard>
      <SkCard>
        <SkText variant="label" width="30%" />
        <Skeleton height={180} radius={12} />
        <SkText variant="bodySm" width="90%" />
        <SkText variant="bodySm" width="70%" />
      </SkCard>
    </>
  );
}

/** Form (edit trade, kuis): beberapa kolom isian + tombol. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <SkCard style={{ gap: 12 }}>
      {range(fields).map((i) => (
        <View key={i} style={{ gap: 6 }}>
          <SkText variant="bodySm" width="30%" />
          <Skeleton height={46} radius={12} />
        </View>
      ))}
      <Skeleton height={48} radius={999} />
    </SkCard>
  );
}
