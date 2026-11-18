import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Tier = "FREE" | "VIP" | "MEMBERSHIP";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  tier: Tier;
  /** tier setelah memperhitungkan masa aktif (sama seperti lib/tier.ts di web) */
  effectiveTier: Tier;
  vip_expires_at: string | null;
  is_admin: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const RANK: Record<Tier, number> = { FREE: 0, VIP: 1, MEMBERSHIP: 2 };
export const hasAccess = (tier: Tier | undefined, required: Tier) => RANK[tier ?? "FREE"] >= RANK[required];

async function loadProfile(userId: string, email: string | undefined): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, tier, vip_expires_at, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const stored: Tier = data.tier === "VIP" || data.tier === "MEMBERSHIP" ? data.tier : "FREE";
  const expired = !!data.vip_expires_at && new Date(data.vip_expires_at).getTime() <= Date.now();
  return {
    id: data.id,
    full_name: data.full_name,
    email: email ?? null,
    tier: stored,
    effectiveTier: stored !== "FREE" && expired ? "FREE" : stored,
    vip_expires_at: data.vip_expires_at,
    is_admin: !!data.is_admin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) setProfile(await loadProfile(data.session.user.id, data.session.user.email));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setProfile(null);
      else loadProfile(next.user.id, next.user.email).then(setProfile);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) setProfile(await loadProfile(session.user.id, session.user.email));
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
