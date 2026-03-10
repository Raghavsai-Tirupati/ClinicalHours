import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  premiumExpiresAt: string | null;
  activatePremium: () => Promise<void>;
  deactivatePremium: () => Promise<void>;
}

export function usePremiumStatus(): PremiumStatus {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["premium-status", user?.id],
    queryFn: async () => {
      if (!user) return { is_premium: false, premium_expires_at: null };

      const { data, error } = await supabase
        .from("profiles")
        .select("is_premium, premium_expires_at")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch premium status:", error);
        return { is_premium: false, premium_expires_at: null };
      }

      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const isPremium = data?.is_premium ?? false;
  const premiumExpiresAt = data?.premium_expires_at ?? null;

  const activatePremium = async () => {
    // Placeholder for Stripe Checkout redirect.
    // When Stripe is integrated, this will create a Checkout Session
    // and redirect the user to Stripe's hosted payment page.
    // On success, a Stripe webhook creates a subscription row,
    // which triggers sync_premium_status() to update profiles.is_premium.
    console.log("[Premium] Stripe checkout not yet configured");
  };

  const deactivatePremium = async () => {
    // Placeholder for Stripe Customer Portal / cancel flow.
    queryClient.invalidateQueries({ queryKey: ["premium-status"] });
  };

  return { isPremium, isLoading, premiumExpiresAt, activatePremium, deactivatePremium };
}
