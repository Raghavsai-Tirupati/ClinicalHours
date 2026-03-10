import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView } from "@/lib/tracking";

export default function PageViewTracker() {
  const location = useLocation();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    trackPageView(userId);
  }, [location.pathname, location.search, userId]);

  return null;
}
