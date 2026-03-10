import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Lock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import { logger } from "@/lib/logger";
import { validatePasswordStrength } from "@/lib/inputValidation";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      toast.error(passwordValidation.error || "Password needs at least 8 characters with both letters and numbers.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { token, newPassword: password },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setStatus("success");
      toast.success("Password reset successfully!");
    } catch (error: unknown) {
      logger.error("Error resetting password", error);
      setStatus("error");
      const errMsg = error instanceof Error ? error.message : "";
      const displayMessage = errMsg.includes("expired") || errMsg.includes("invalid")
        ? "This reset link is invalid or has expired. Please request a new one."
        : errMsg.includes("password") || errMsg.includes("length") || errMsg.includes("character") || errMsg.includes("letter") || errMsg.includes("number") || errMsg.includes("digit")
        ? "Password needs at least 8 characters with both letters and numbers."
        : "Failed to reset password. Please try again.";
      setErrorMessage(displayMessage);
      toast.error(displayMessage);
    } finally {
      setLoading(false);
    }
  };

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Reset Link</h1>
            <p className="text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
          </div>
          <Link to="/auth">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Password Reset!</h1>
            <p className="text-muted-foreground">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
          </div>
          <Button onClick={() => navigate("/auth")} className="gap-2">
            Sign In Now
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Reset Failed</h1>
            <p className="text-muted-foreground">{errorMessage}</p>
          </div>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => {
                setStatus("idle");
                setErrorMessage("");
              }}
              className="w-full"
            >
              Try Again
            </Button>
            <Link to="/auth" className="block">
              <Button variant="ghost" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <img src={logo} alt="ClinicalHours" className="h-16 w-auto mx-auto mb-4" />
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Create New Password</h1>
          <p className="text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>

        <div className="text-center">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
