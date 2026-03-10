import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

// LOCAL DEV: everything is unlocked. Flip to false when you wire up real payments.
const DEV_PREMIUM_BYPASS = true;

interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  premiumExpiresAt: string | null;
  activatePremium: () => Promise<void>;
  deactivatePremium: () => Promise<void>;
}

export function usePremiumStatus(): PremiumStatus {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(DEV_PREMIUM_BYPASS);
  const isLoading = false;
  const premiumExpiresAt = null;

  const activatePremium = useCallback(async () => {
    setIsPremium(true);
  }, []);

  const deactivatePremium = useCallback(async () => {
    setIsPremium(false);
  }, []);

  return { isPremium, isLoading, premiumExpiresAt, activatePremium, deactivatePremium };
}
