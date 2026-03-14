import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useEmailVerified() {
  const { user } = useAuth();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmailVerified = useCallback(async () => {
    if (!user) {
      setEmailVerified(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("email_verified")
        .eq("id", user.id)
        .single();

      setEmailVerified(data?.email_verified ?? false);
    } catch {
      setEmailVerified(false);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEmailVerified();
  }, [fetchEmailVerified]);

  const needsVerification = !!user && emailVerified === false;
  const isVerified = !!user && emailVerified === true;

  return {
    emailVerified: emailVerified ?? false,
    needsVerification,
    isVerified,
    loading,
    refetch: fetchEmailVerified,
  };
}
