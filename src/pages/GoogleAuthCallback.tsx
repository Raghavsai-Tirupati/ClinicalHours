import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "success" | "error";

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const returnPath = sessionStorage.getItem("gmail_oauth_return_path") || "/hospital-dashboard/settings";
    sessionStorage.removeItem("gmail_oauth_return_path");

    const errorParam = params.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage(errorParam);
      setTimeout(() => navigate(returnPath), 3000);
      return;
    }

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      setStatus("error");
      setMessage("Missing authorization code or state parameter.");
      return;
    }

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          navigate("/auth");
          return;
        }

        const { data, error } = await supabase.functions.invoke("gmail-oauth-callback", {
          body: { code, state },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (error || !data?.success) {
          setStatus("error");
          setMessage(data?.error || error?.message || "Failed to connect Gmail.");
          setTimeout(() => navigate(returnPath), 4000);
          return;
        }

        setStatus("success");
        setMessage(`Gmail connected: ${data.gmail_email}`);
        setTimeout(() => navigate(returnPath), 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unexpected error");
        setTimeout(() => navigate(returnPath), 4000);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-lg">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-muted-foreground">Connecting Gmail…</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-foreground">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-medium text-destructive">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
