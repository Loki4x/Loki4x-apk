import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Redirect } from "expo-router";
import { Button, Card, Screen, SkeletonPage, T } from "@/components/ui";
import { BackHeader, Field } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { INSTRUMENTS } from "@/shared/lot-calc";

const PAIR_OPTIONS = INSTRUMENTS.filter((i) => i.symbol !== "CUSTOM").map((i) => i.symbol);

type PrefKey = "notify_signals" | "notify_weekly" | "notify_news" | "notify_receipts" | "notify_expiry";
const PREFS: { key: PrefKey; title: string; desc: string }[] = [
  { key: "notify_signals", title: "Notifikasi sinyal trading", desc: "Push saat ada sinyal baru, update, dan sinyal ditutup. Khusus VIP & Membership." },
  { key: "notify_weekly", title: "Laporan mingguan & bulanan", desc: "Ringkasan performa lewat email: setiap Sabtu pagi, dan rekap bulanan tiap tanggal 1." },
  { key: "notify_news", title: "Pengingat berita high-impact", desc: "Pengingat sebelum berita high-impact rilis. Khusus Membership." },
  { key: "notify_receipts", title: "Kwitansi pembayaran", desc: "Email kwitansi setiap kali upgrade berhasil." },
  { key: "notify_expiry", title: "Peringatan masa aktif Membership & VIP", desc: "Pengingat email menjelang dan saat masa aktif habis." },
];

type Msg = { ok: boolean; text: string } | null;

/** Pengaturan profil, notifikasi, dan kata sandi (sama dengan /settings di web; disimpan langsung ke profil). */
export default function SettingsScreen() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const userId = session?.user.id;
  const hasPassword = (session?.user.identities ?? []).some((i) => i.provider === "email");

  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    notify_signals: true,
    notify_weekly: true,
    notify_news: true,
    notify_receipts: true,
    notify_expiry: true,
  });
  const [pairs, setPairs] = useState<string[]>([]);
  const [prefsMsg, setPrefsMsg] = useState<Msg>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("full_name, username, bio, notify_signals, notify_weekly, notify_news, notify_receipts, notify_expiry, signal_pairs")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? "");
          setUsername(data.username ?? "");
          setBio(data.bio ?? "");
          setPrefs({
            notify_signals: data.notify_signals ?? true,
            notify_weekly: data.notify_weekly ?? true,
            notify_news: data.notify_news ?? true,
            notify_receipts: data.notify_receipts ?? true,
            notify_expiry: data.notify_expiry ?? true,
          });
          setPairs(Array.isArray(data.signal_pairs) ? data.signal_pairs : []);
        }
        setLoaded(true);
      });
  }, [userId]);

  if (!session || !userId) return <Redirect href="/login" />;

  async function saveProfile() {
    setProfileMsg(null);
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (!clean) {
      setProfileMsg({ ok: false, text: "Username tidak boleh kosong." });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim().slice(0, 80), username: clean, bio: bio.slice(0, 160) })
      .eq("id", userId);
    setSavingProfile(false);
    if (error) {
      setProfileMsg({ ok: false, text: error.code === "23505" ? "Username sudah dipakai, coba yang lain." : error.message });
      return;
    }
    setUsername(clean);
    setProfileMsg({ ok: true, text: "Profil berhasil disimpan." });
    refreshProfile();
  }

  async function savePrefs(nextPrefs: Record<PrefKey, boolean>, nextPairs: string[]) {
    setPrefs(nextPrefs);
    setPairs(nextPairs);
    setPrefsMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ ...nextPrefs, signal_pairs: nextPairs.length > 0 ? nextPairs : null })
      .eq("id", userId);
    setPrefsMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Preferensi notifikasi disimpan." });
  }

  async function changePassword() {
    setPwMsg(null);
    if (next.length < 6) return setPwMsg({ ok: false, text: "Kata sandi baru minimal 6 karakter." });
    if (next !== confirm) return setPwMsg({ ok: false, text: "Konfirmasi kata sandi tidak cocok." });
    setSavingPw(true);
    try {
      if (hasPassword && session?.user.email) {
        const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password: current });
        if (error) return setPwMsg({ ok: false, text: "Kata sandi saat ini salah." });
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) return setPwMsg({ ok: false, text: error.message });
      if (signOutOthers) await supabase.auth.signOut({ scope: "others" });
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwMsg({ ok: true, text: "Kata sandi berhasil diubah." });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <Screen>
      <BackHeader title="Pengaturan" fallback="/account" />
      {!loaded && <SkeletonPage variant="kpi" />}

      {loaded && (
        <>
          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Profil</T>
            <Field label="Nama tampilan" value={fullName} onChangeText={setFullName} placeholder="Nama kamu" autoCapitalize="sentences" />
            <Field label="Username" value={username} onChangeText={setUsername} placeholder="username_unik" hint="Huruf kecil, angka, dan garis bawah." />
            <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Bio singkat tentang diri kamu" multiline autoCapitalize="sentences" />
            {profileMsg && <T variant="bodySm" color={profileMsg.ok ? "success" : "error"}>{profileMsg.text}</T>}
            <Button title="Simpan profil" onPress={saveProfile} loading={savingProfile} />
          </Card>

          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">Notifikasi</T>
            {PREFS.map((p) => (
              <View key={p.key} style={styles.pref}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="bodySm" style={{ fontWeight: "700" }}>{p.title}</T>
                  <T variant="caption" color="textMuted">{p.desc}</T>
                </View>
                <Switch
                  value={prefs[p.key]}
                  onValueChange={(v) => savePrefs({ ...prefs, [p.key]: v }, pairs)}
                  trackColor={{ true: colors.primary, false: colors.surface2 }}
                />
              </View>
            ))}
            {prefs.notify_signals && (
              <View style={{ gap: 6 }}>
                <T variant="bodySm" style={{ fontWeight: "700" }}>Pair yang mau kamu terima</T>
                <T variant="caption" color="textMuted">
                  {pairs.length === 0 ? "Sekarang: semua pair. Pilih pair tertentu untuk membatasi notifikasi sinyal." : "Hanya sinyal dari pair terpilih yang dikirim."}
                </T>
                <View style={styles.pairs}>
                  {PAIR_OPTIONS.map((s) => {
                    const on = pairs.includes(s);
                    return (
                      <Pressable
                        key={s}
                        onPress={() => savePrefs(prefs, on ? pairs.filter((x) => x !== s) : [...pairs, s])}
                        style={[styles.pair, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySubtle : colors.surface2 }]}
                      >
                        <T variant="caption" style={{ fontWeight: "600", color: on ? colors.primary : colors.textSecondary }}>{s}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <T variant="caption" color="textMuted">Email keamanan (ganti kata sandi, login baru) selalu aktif.</T>
            {prefsMsg && <T variant="bodySm" color={prefsMsg.ok ? "success" : "error"}>{prefsMsg.text}</T>}
          </Card>

          <Card style={{ gap: 12 }}>
            <T variant="label" color="textMuted">{hasPassword ? "Ubah kata sandi" : "Buat kata sandi"}</T>
            {!hasPassword && (
              <T variant="caption" color="textMuted">
                Akun kamu login pakai Google dan belum punya kata sandi. Buat satu supaya bisa juga login pakai email + kata sandi.
              </T>
            )}
            {hasPassword && <Field label="Kata sandi saat ini" value={current} onChangeText={setCurrent} secure />}
            <Field label="Kata sandi baru" value={next} onChangeText={setNext} secure />
            <Field label="Konfirmasi kata sandi baru" value={confirm} onChangeText={setConfirm} secure />
            <View style={styles.pref}>
              <T variant="bodySm" style={{ flex: 1 }}>Keluar dari semua sesi lain</T>
              <Switch value={signOutOthers} onValueChange={setSignOutOthers} trackColor={{ true: colors.primary, false: colors.surface2 }} />
            </View>
            {pwMsg && <T variant="bodySm" color={pwMsg.ok ? "success" : "error"}>{pwMsg.text}</T>}
            <Button title="Simpan kata sandi" onPress={changePassword} loading={savingPw} disabled={!next || !confirm || (hasPassword && !current)} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pref: { flexDirection: "row", alignItems: "center", gap: 12 },
  pairs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pair: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
});
