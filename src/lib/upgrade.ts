import { apiGet, apiRequest, apiUpload } from "@/lib/api";

// Upgrade & pembayaran: semua harga, promo, dan paket dihitung di server web (lib/upgrade-core.ts).

export type Plan = "VIP" | "MEMBERSHIP" | "MEMBERSHIP_LIFETIME";
export type UsdtNetwork = "BEP20" | "TRC20";
export type Tier = "FREE" | "VIP" | "MEMBERSHIP";

export interface UpgradeInfo {
  status: { tier: Tier; storedTier: Tier; expiresAt: string | null; expired: boolean; permanent: boolean };
  plans: Plan[];
  priceIdr: Record<Plan, number>;
  priceUsdt: Record<Plan, number>;
  wallets: Record<UsdtNetwork, { address: string; label: string }>;
  brokers: Record<string, { name: string; link: string }>;
  vipRequest: { status: "PENDING" | "APPROVED" | "REJECTED"; broker: string | null; created_at: string; rejection_reason?: string | null } | null;
}

export interface PromoQuote {
  code: string;
  idr: { original: number; discount: number; final: number };
  usdt: { original: number; discount: number; final: number };
}

export const PLAN_INFO: Record<Plan, { name: string; price: string; period: string; features: string[]; featured?: boolean }> = {
  VIP: { name: "VIP", price: "$20", period: "/ bulan", features: ["Signals & Track Record", "Market Positioning"] },
  MEMBERSHIP: {
    name: "Membership",
    price: "$35",
    period: "/ bulan",
    features: ["Semua fitur VIP", "Journal, Reports, Calculator", "Akses penuh Academy"],
    featured: true,
  },
  MEMBERSHIP_LIFETIME: {
    name: "Membership Lifetime",
    price: "$70",
    period: "sekali bayar",
    features: ["Semua fitur Membership", "Bayar sekali, akses selamanya", "Nggak perlu perpanjang tiap bulan"],
  },
};

export const ADMIN_CONTACT_LINK = "https://t.me/LokiForex";

export const isPlan = (v: unknown): v is Plan => v === "VIP" || v === "MEMBERSHIP" || v === "MEMBERSHIP_LIFETIME";

/** Label tombol: user baru "Bayar Sekarang", member aktif "Perpanjang" (tier sama) / "Upgrade" (tier lebih tinggi). */
export function planCtaLabel(plan: Plan, activeTier: Tier) {
  if (activeTier === "FREE") return "Bayar Sekarang";
  if (plan === "MEMBERSHIP_LIFETIME") return "Beli Lifetime";
  return (plan === "VIP" ? "VIP" : "MEMBERSHIP") === activeTier ? "Perpanjang" : "Upgrade";
}

export const formatIdr = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export const fetchUpgradeInfo = () => apiGet<UpgradeInfo>("/api/mobile/upgrade");

export const previewPromo = (plan: Plan, code: string) =>
  apiRequest<{ ok: true } & PromoQuote>("POST", "/api/mobile/upgrade/promo", { plan, code });

export const createOnlinePayment = (plan: Plan, promoCode: string | null) =>
  apiRequest<{ ok: true; orderId: string; amount: number; paymentUrl: string; expiredAt: string }>("POST", "/api/mobile/upgrade/pay", {
    plan,
    promoCode,
  });

export const checkPayment = (orderId: string) =>
  apiGet<{ status: "COMPLETED" | "PENDING" | "NOT_FOUND" | null }>(`/api/mobile/upgrade/pay/${encodeURIComponent(orderId)}`).then((r) => r.status);

export function submitUsdt(input: { plan: Plan; network: UsdtNetwork; slipUri: string; note: string; promoCode: string | null }) {
  const form = new FormData();
  form.append("plan", input.plan);
  form.append("network", input.network);
  form.append("note", input.note);
  form.append("promo_code", input.promoCode ?? "");
  form.append("slip", { uri: input.slipUri, name: "bukti-transfer.jpg", type: "image/jpeg" } as unknown as Blob);
  return apiUpload<{ ok: true }>("/api/mobile/upgrade/usdt", form);
}

export const submitVipRequest = (input: { broker: string; broker_email: string; trading_account_id: string; first_deposit: string }) =>
  apiRequest<{ ok: true }>("POST", "/api/mobile/upgrade/vip-request", { ...input, agree_terms: "on" });
