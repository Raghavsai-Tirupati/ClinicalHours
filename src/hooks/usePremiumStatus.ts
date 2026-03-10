import { useCallback } from "react";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  premiumExpiresAt: string | null;
  activatePremium: () => Promise<void>;
  deactivatePremium: () => Promise<void>;
}

export function usePremiumStatus(): PremiumStatus {
  const { isAdmin, isLoading } = useAdminCheck();

  const activatePremium = useCallback(async () => {
    // No-op until real payments are wired up
  }, []);

  const deactivatePremium = useCallback(async () => {
    // No-op until real payments are wired up
  }, []);

  return {
    isPremium: isAdmin,
    isLoading,
    premiumExpiresAt: null,
    activatePremium,
    deactivatePremium,
  };
}
