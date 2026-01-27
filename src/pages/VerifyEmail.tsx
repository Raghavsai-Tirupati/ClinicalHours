import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Mail } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "already_verified" | "signing_in">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token provided");
      return;
    }

    verifyEmail();
  }, [token]);

  const claimSessionAndLogin = async (sessionToken: string, userId: string) => {
    try {
      setStatus("signing_in");

      const { data, error } = await supabase.functions.invoke("claim-verification-session", {
        body: { sessionToken, userId },
      });

      if (error || data.error) {
        logger.error("Failed to claim session", error || data.error);
        // Fall back to manual sign in
        setStatus("success");
        return;
      }

      // If we got a magic link, use it to sign in
      if (data.magicLink) {
        // Extract tokens from magic link and set session
        const url = new URL(data.magicLink);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!sessionError) {
            toast.success("Email verified! Welcome to ClinicalHours!");
            navigate("/dashboard");
            return;
          }
        }
      }

      // If we got tokens directly
      if (data.accessToken && data.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        });

        if (!sessionError) {
          toast.success("Email verified! Welcome to ClinicalHours!");
          navigate("/dashboard");
          return;
        }
      }

      // Fall back to showing success with sign in button
      setStatus("success");
    } catch (error) {
      logger.error("Session claim error", error);
      setStatus("success");
    }
  };

  const verifyEmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-email", {
        body: { token },
      });

      if (error) {
        throw new Error(error.message || "Verification failed");
      }

      if (data.error) {
        if (data.alreadyVerified) {
          setStatus("already_verified");
        } else {
          setStatus("error");
          setErrorMessage(data.error);
        }
        return;
      }

      setEmail(data.email || "");

      // If we got a session token, try to auto-login
      if (data.sessionToken && data.userId) {
        await claimSessionAndLogin(data.sessionToken, data.userId);
      } else {
        setStatus("success");
      }
    } catch (error: unknown) {
      logger.error("Verification error", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to verify email. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Back to Home Link */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Home</span>
      </Link>

      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <img src={logo} alt="ClinicalHours" className="h-12 w-auto mx-auto" />
          <div>
            <CardTitle className="text-2xl">
              {status === "loading" && "Verifying Email..."}
              {status === "signing_in" && "Email Verified!"}
              {status === "success" && "Email Verified!"}
              {status === "already_verified" && "Already Verified"}
              {status === "error" && "Verification Failed"}
            </CardTitle>
            <CardDescription className="mt-2">
              {status === "loading" && "Please wait while we verify your email address."}
              {status === "signing_in" && "Signing you in automatically..."}
              {status === "success" && "Your email has been successfully verified."}
              {status === "already_verified" && "Your email address has already been verified."}
              {status === "error" && "We couldn't verify your email address."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </div>
          )}

          {status === "signing_in" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                <CheckCircle2 className="relative h-16 w-16 text-green-500" />
              </div>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Email verified! Signing you in...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                <CheckCircle2 className="relative h-20 w-20 text-green-500" />
              </div>
              {email && (
                <p className="text-muted-foreground text-center">
                  <Mail className="inline-block w-4 h-4 mr-1" />
                  {email}
                </p>
              )}
              <p className="text-center text-foreground">
                You can now sign in to your account and start exploring clinical opportunities!
              </p>
              <Button 
                onClick={() => navigate("/auth")} 
                className="w-full mt-4"
                size="lg"
              >
                Sign In Now
              </Button>
            </div>
          )}

          {status === "already_verified" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <p className="text-center text-muted-foreground">
                Your account is ready to use. You can sign in anytime.
              </p>
              <Button 
                onClick={() => navigate("/auth")} 
                className="w-full mt-4"
                size="lg"
              >
                Go to Sign In
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl" />
                <XCircle className="relative h-16 w-16 text-destructive" />
              </div>
              <p className="text-center text-muted-foreground">
                {errorMessage}
              </p>
              <div className="flex flex-col gap-2 w-full mt-4">
                <Button 
                  onClick={() => navigate("/auth")} 
                  className="w-full"
                  size="lg"
                >
                  Back to Sign Up
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Need help? Contact us at support@clinicalhours.org
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
