import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const CheckEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const userId = searchParams.get("uid") || "";
  const fullName = searchParams.get("name") || "User";
  
  const [resendLoading, setResendLoading] = useState(false);

  const handleResendVerification = async () => {
    if (!userId || !email) {
      toast.error("Missing user information. Please try signing up again.");
      return;
    }
    
    setResendLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-verification-email", {
        body: {
          userId,
          email,
          fullName,
          origin: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }
      
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      toast.error("Failed to send verification email. Please try again.");
    } finally {
      setResendLoading(false);
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
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription className="mt-2">
              We've sent a verification link to complete your registration.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>
            </div>
            
            {email && (
              <p className="text-foreground font-medium text-center">
                {email}
              </p>
            )}

            {/* 24-hour warning */}
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 w-full">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">
                <strong>Verify within 24 hours</strong> or your account will be automatically deleted.
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-left w-full">
              <p className="text-sm text-muted-foreground mb-3">
                Click the link in the email to verify your account. If you don't see it, check your spam folder.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResendVerification}
                disabled={resendLoading || !userId}
              >
                {resendLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </div>

            {/* Continue to Dashboard button */}
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full"
              size="lg"
            >
              Continue to Dashboard
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-2">
              Already verified?{" "}
              <button 
                onClick={() => navigate("/auth")}
                className="text-primary hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckEmail;
