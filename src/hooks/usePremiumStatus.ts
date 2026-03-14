import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";

type ProfilePremium = {
  is_premium: boolean | null;
  premium_expires_at: string | null;
  stripe_subscription_id: string | null;
};

interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  premiumExpiresAt: string | null;
  stripeSubscriptionId: string | null;
  refetch: () => Promise<void>;
  // Kept for backward compatibility with Premium.tsx (now no-ops)
  activatePremium: () => Promise<void>;
  deactivatePremium: () => Promise<void>;
}

export function usePremiumStatus(): PremiumStatus {
  const { user, isReady } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-premium", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("is_premium, premium_expires_at, stripe_subscription_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfilePremium | null;
    },
    enabled: !!user?.id && isReady,
    staleTime: 30 * 1000, // 30 seconds — fresh enough, not too chatty
    refetchOnWindowFocus: true,
  });

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["profile-premium", user?.id] });
  }, [queryClient, user?.id]);

  // Premium is active when:
  //   1. User is an admin (existing admin accounts keep access), OR
  //   2. is_premium is true AND either no expiry is set (active sub) OR expiry is in the future
  const profileIsPremium = (() => {
    if (!profile?.is_premium) return false;
    if (!profile.premium_expires_at) return true; // Active sub, no pending cancellation
    return new Date(profile.premium_expires_at) > new Date(); // Pending cancel but still in billing period
  })();

  const isPremium = isAdmin || profileIsPremium;

  // Show loading state until both auth + profile are resolved (only if user is logged in)
  const isLoading = !isReady || adminLoading || (!!user && profileLoading);

  const activatePremium = useCallback(async () => {
    // No-op — premium is set via Stripe webhook only
  }, []);

  const deactivatePremium = useCallback(async () => {
    // No-op — premium is managed via Stripe
  }, []);

  return {
    isPremium,
    isLoading,
    premiumExpiresAt: profile?.premium_expires_at ?? null,
    stripeSubscriptionId: (profile as ProfilePremium | null)?.stripe_subscription_id ?? null,
    refetch,
    activatePremium,
    deactivatePremium,
  };
}
