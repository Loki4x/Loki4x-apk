import { useEffect, useRef, useState } from "react";
import { AppState, Image, Pressable, StyleSheet, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { BackHeader, Field, OptionChips, TermsCheckbox } from "@/components/form";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { friendlyApiError } from "@/lib/journal";
import { pickPhoto } from "@/lib/media";
import {
  checkPayment,
  createOnlinePayment,
  fetchUpgradeInfo,
  formatIdr,
  isPlan,
  PLAN_INFO,
  previewPromo,
  submitUsdt,
  type PromoQuote,
  type UpgradeInfo,
  type UsdtNetwork,
} from "@/lib/upgrade";

type Method = "ONLINE" | "USDT";

/** Pembayaran satu paket: kode promo → QRIS / Virtual Account (Poketo) atau USDT (bukti transfer). */
export default function PaymentScreen() {
  const params = useLocalSearchParams<{ plan?: string }>();
  const plan = isPlan(params.plan) ? params.plan : null;
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [step, setStep] = useState<"promo" | "pay" | "done">("promo");
  const [agreed, setAgreed] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoQuote | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [method, setMethod] = useState<Method>("ONLINE");

  // QRIS & bank
  const [order, setOrder] = useState<{ orderId: string; amount: number; paymentUrl: string } | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const requested = useRef(false);

  // USDT
  const [network, setNetwork] = useState<UsdtNetwork>("BEP20");
  const [slip, setSlip] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [usdtBusy, setUsdtBusy] = useState(false);
  const [usdtError, setUsdtError] = useState<string | null>(null);
  const [usdtSent, setUsdtSent] = useState(false);

  useEffect(() => {
    fetchUpgradeInfo().then(setInfo).catch(() => {});
  }, []);

  // Buat tagihan QRIS/bank sekali saat masuk langkah bayar.
  useEffect(() => {
    if (step !== "pay" || method !== "ONLINE" || requested.current || !plan) return;
    requested.current = true;
    makeOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, method, plan]);

  // Cek status pembayaran tiap 5 detik, dan langsung saat kembali dari browser.
  useEffect(() => {
    if (!order || step === "done") return;
    let stopped = false;
    const check = async () => {
      try {
        if ((await checkPayment(order.orderId)) === "COMPLETED" && !stopped) {
          stopped = true;
          setStep("done");
          refreshProfile();
        }
      } catch {
        // coba lagi di putaran berikutnya
      }
    };
    const timer = setInterval(check, 5000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [order, step, refreshProfile]);

  if (!session) return <Redirect href="/login" />;
  if (!plan) return <Redirect href="/upgrade" />;

  async function applyPromo(): Promise<boolean> {
    if (!plan) return false;
    setPromoError(null);
    setPromoBusy(true);
    try {
      const res = await previewPromo(plan, promoInput.trim());
      setPromo({ code: res.code, idr: res.idr, usdt: res.usdt });
      return true;
    } catch (err) {
      setPromo(null);
      setPromoError(friendlyApiError(err));
      return false;
    } finally {
      setPromoBusy(false);
    }
  }

  async function next() {
    // Kode sudah diketik tapi belum diterapkan: terapkan dulu, lanjut hanya kalau valid.
    if (promoInput.trim() && !promo && !(await applyPromo())) return;
    setStep("pay");
  }

  async function makeOrder() {
    if (!plan) return;
    setOrderError(null);
    setOrderBusy(true);
    try {
      const res = await createOnlinePayment(plan, promo?.code ?? null);
      setOrder({ orderId: res.orderId, amount: res.amount, paymentUrl: res.paymentUrl });
    } catch (err) {
      setOrderError(friendlyApiError(err));
    } finally {
      setOrderBusy(false);
    }
  }

  async function sendUsdt() {
    if (!plan) return;
    setUsdtError(null);
    if (!slip) {
      setUsdtError("Bukti transfer wajib diupload.");
      return;
    }
    setUsdtBusy(true);
    try {
      await submitUsdt({ plan, network, slipUri: slip, note: note.trim(), promoCode: promo?.code ?? null });
      setUsdtSent(true);
    } catch (err) {
      setUsdtError(friendlyApiError(err));
    } finally {
      setUsdtBusy(false);
    }
  }

  const name = PLAN_INFO[plan].name;
  const idrPrice = promo?.idr.final ?? info?.priceIdr[plan];
  const usdtPrice = promo?.usdt.final ?? info?.priceUsdt[plan];
  const wallet = info?.wallets[network];

  return (
    <Screen>
      <BackHeader title="Pembayaran" fallback="/upgrade" />
      <Card>
        <T variant="h3">{name}</T>
        {idrPrice !== undefined && (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            {promo && <T variant="bodySm" color="textMuted" style={{ textDecorationLine: "line-through" }}>{formatIdr(promo.idr.original)}</T>}
            <T variant="h2" color={promo ? "success" : "text"}>{formatIdr(idrPrice)}</T>
            <T variant="bodySm" color="textMuted">atau {usdtPrice} USDT</T>
          </View>
        )}
      </Card>

      {step === "done" && (
        <Card style={{ alignItems: "center", paddingVertical: 24 }}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <T variant="h3">Pembayaran berhasil!</T>
          <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>Akun kamu sekarang aktif sebagai {name}. Terima kasih!</T>
          <Button title="Selesai" onPress={() => router.replace("/")} style={{ alignSelf: "stretch", marginTop: 8 }} />
        </Card>
      )}

      {step === "promo" && (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <Field
              label="Kode promo (opsional)"
              value={promoInput}
              onChangeText={(v) => {
                setPromoInput(v.toUpperCase());
                setPromo(null);
              }}
              placeholder="Masukkan kode promo"
              autoCapitalize="characters"
            />
            <Button title="Terapkan" variant="secondary" onPress={applyPromo} loading={promoBusy} disabled={!promoInput.trim()} />
          </View>
          {promo && (
            <T variant="bodySm" color="success">
              Kode {promo.code} diterapkan · hemat {formatIdr(promo.idr.discount)}
            </T>
          )}
          {promoError && <T variant="bodySm" color="error">{promoError}</T>}
          <TermsCheckbox anchor="paket-berbayar" checked={agreed} onChange={setAgreed} />
          <Button title="Lanjut ke pembayaran" onPress={next} disabled={!agreed} loading={promoBusy} />
        </Card>
      )}

      {step === "pay" && (
        <>
          <OptionChips
            label="Metode pembayaran"
            options={[
              { value: "ONLINE", label: "QRIS & Bank" },
              { value: "USDT", label: "USDT" },
            ]}
            value={method}
            onChange={setMethod}
          />

          {method === "ONLINE" && (
            <Card style={{ gap: 12 }}>
              {orderBusy && <T variant="bodySm" color="textMuted">Menyiapkan pembayaran…</T>}
              {orderError && (
                <>
                  <T variant="bodySm" color="error">{orderError}</T>
                  <Button title="Coba lagi" variant="secondary" onPress={makeOrder} />
                </>
              )}
              {order && (
                <>
                  <T variant="bodySm" color="textSecondary">
                    Pembayaran siap. Pilih QRIS atau Virtual Account bank di halaman pembayaran yang aman.
                  </T>
                  <Button title={`Bayar sekarang — ${formatIdr(order.amount)}`} onPress={() => WebBrowser.openBrowserAsync(order.paymentUrl)} />
                  <T variant="caption" color="textMuted">Biaya layanan dan biaya metode pembayaran ditambahkan di halaman pembayaran.</T>
                  <T variant="caption" color="textMuted">
                    ⏳ Menunggu pembayaran — layar ini otomatis update begitu pembayaran masuk.
                  </T>
                </>
              )}
            </Card>
          )}

          {method === "USDT" &&
            (usdtSent ? (
              <Card style={{ alignItems: "center", paddingVertical: 22 }}>
                <Ionicons name="time-outline" size={40} color={colors.primary} />
                <T variant="h3">Bukti transfer terkirim</T>
                <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>
                  Admin akan verifikasi manual (biasanya beberapa jam). Kamu akan dapat notifikasi begitu akun kamu aktif.
                </T>
                <Button title="Selesai" onPress={() => router.replace("/")} style={{ alignSelf: "stretch", marginTop: 8 }} />
              </Card>
            ) : (
              <Card style={{ gap: 12 }}>
                <OptionChips
                  label="Jaringan"
                  options={[
                    { value: "BEP20", label: "BEP20 (BSC)" },
                    { value: "TRC20", label: "TRC20 (Tron)" },
                  ]}
                  value={network}
                  onChange={setNetwork}
                />
                {wallet && (
                  <>
                    <T variant="caption" color="warning">
                      Kirim hanya USDT jaringan {wallet.label}. Kirim lewat jaringan lain bisa mengakibatkan dana hilang.
                    </T>
                    <View style={[styles.wallet, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="caption" color="textMuted">Alamat deposit ({wallet.label})</T>
                        <T variant="bodySm" style={{ fontWeight: "700" }}>{wallet.address}</T>
                      </View>
                      <Pressable
                        onPress={async () => {
                          await Clipboard.setStringAsync(wallet.address);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={copied ? colors.success : colors.primary} />
                      </Pressable>
                    </View>
                    <T variant="bodySm">
                      Jumlah: <T variant="bodySm" style={{ fontWeight: "700" }}>{usdtPrice} USDT</T>
                    </T>
                  </>
                )}
                <T variant="bodySm" color="textSecondary">Bukti transfer (wajib)</T>
                <Pressable
                  onPress={async () => {
                    try {
                      const uri = await pickPhoto();
                      if (uri) setSlip(uri);
                    } catch {
                      setUsdtError("Foto tidak bisa dibuka. Coba pilih foto lain.");
                    }
                  }}
                  style={[styles.slip, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
                >
                  {slip ? (
                    <Image source={{ uri: slip }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : (
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <Ionicons name="cloud-upload-outline" size={26} color={colors.textMuted} />
                      <T variant="caption" color="textMuted">Pilih screenshot bukti transfer</T>
                    </View>
                  )}
                </Pressable>
                <Field label="Catatan (opsional)" value={note} onChangeText={setNote} placeholder="TxID / hash transaksi" />
                {usdtError && <T variant="bodySm" color="error">{usdtError}</T>}
                <Button title="Saya sudah transfer" onPress={sendUsdt} loading={usdtBusy} disabled={!slip} />
              </Card>
            ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wallet: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  slip: { height: 160, borderWidth: 1, borderStyle: "dashed", borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
