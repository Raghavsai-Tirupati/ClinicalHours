import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { logAuthEvent } from "@/lib/auditLogger";
import { setRememberMePreference, getRememberMePreference, useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import { ArrowLeft, Mail, Loader2, Eye, UserCircle, Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logo.png";
import authBackground from "@/assets/auth-background.png";

// Google icon SVG component
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// Password validation: letters and numbers (both required) and at least 8 characters
const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string()
    .min(8, { message: "Use letters and numbers (both required) and at least 8 digits" })
    .max(128)
    .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
      message: "Use letters and numbers (both required) and at least 8 digits"
    }),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100).optional(),
  phone: z.string().max(20).optional().or(z.literal("")),
});

const Auth = () => {
  const navigate = useNavigate();
  const { enterGuestMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [showPassword, setShowPassword] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleGuestMode = () => {
    enterGuestMode();
    navigate("/dashboard?showTutorial=true");
  };

  // Check if hospital redirect is set
  const isHospitalFlow = new URLSearchParams(window.location.search).get('hospital') === 'true';

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check for OAuth callback in URL hash (for Google Sign-In)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        // Set the session from the OAuth callback
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (data.session && !error) {
          // Clear the hash from the URL
          window.history.replaceState(null, '', window.location.pathname);
          const shouldRedirectHospital = localStorage.getItem("clinicalhours_hospital_redirect") === "true";
          localStorage.removeItem("clinicalhours_hospital_redirect");
          navigate(shouldRedirectHospital ? "/hospital/onboarding" : "/dashboard");
          return;
        }
      }
      
      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const shouldRedirectHospital = localStorage.getItem("clinicalhours_hospital_redirect") === "true";
        localStorage.removeItem("clinicalhours_hospital_redirect");
        navigate(shouldRedirectHospital ? "/hospital/onboarding" : "/dashboard");
      }
    };
    
    handleAuthCallback();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    
    try {
      // Save "remember me" preference BEFORE OAuth redirect
      // This ensures the useAuth hook picks it up when user returns
      setRememberMePreference(rememberMe);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      
      if (error) throw error;
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error("Failed to sign in with Google. Please try again.");
      setGoogleLoading(false);
    }
  };

  const sendVerificationEmail = async (userId: string, userEmail: string, userName: string) => {
    try {
      const { error } = await supabase.functions.invoke("send-verification-email", {
        body: {
          userId,
          email: userEmail,
          fullName: userName,
          origin: window.location.origin,
        },
      });

      if (error) {
        // Error logged silently - user will see toast message
        return false;
      }
      return true;
    } catch (error) {
      // Error logged silently - user will see toast message
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password, fullName, phone });
      
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: validatedData.fullName,
          },
        },
      });

      if (error) throw error;

      // Update phone number and email opt-in preference in profile
      if (data.user) {
        const profileUpdates: Record<string, unknown> = {
          email_opt_in: emailOptIn,
        };
        if (validatedData.phone) {
          profileUpdates.phone = validatedData.phone;
        }
        
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", data.user.id);
      }

      // Send verification email and redirect to check-email page
      if (data.user) {
        logAuthEvent("signup", { email: validatedData.email });
        
        // Sign out immediately - user must verify email first
        await supabase.auth.signOut();
        
        // Send verification email via our custom edge function (sends from clinicalhours.org)
        await sendVerificationEmail(
          data.user.id,
          validatedData.email,
          validatedData.fullName || "User"
        );

        toast.success("Account created! Please check your email to verify your account.");
        
        // Redirect to check-email page
        navigate(`/check-email?email=${encodeURIComponent(validatedData.email)}&uid=${encodeURIComponent(data.user.id)}&name=${encodeURIComponent(validatedData.fullName || "User")}`);
      }
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        // Show actual error message from Supabase to help diagnose issues
        let errorMessage = "Unable to create account. Please check your information and try again.";
        
        // Extract error message from various error formats
        let errorMsg = "";
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (error && typeof error === 'object') {
          if ('message' in error && typeof error.message === 'string') {
            errorMsg = error.message;
          } else if ('error' in error && typeof error.error === 'string') {
            errorMsg = error.error;
          }
        }
        
        if (errorMsg) {
          const lowerMsg = errorMsg.toLowerCase();
          // Show only the specific password error message
          if (lowerMsg.includes('password') || lowerMsg.includes('length') || lowerMsg.includes('character') || lowerMsg.includes('letter') || lowerMsg.includes('number') || lowerMsg.includes('digit')) {
            errorMessage = "Use letters and numbers (both required) and at least 8 digits";
          } else if (lowerMsg.includes('email') || lowerMsg.includes('already') || lowerMsg.includes('exists')) {
            // Don't reveal if email exists for security (prevent email enumeration)
            errorMessage = "Unable to create account. Please check your information and try again.";
          } else {
            // For other errors, show the message
            errorMessage = errorMsg;
          }
        }
        
        console.error("Sign up error:", error);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password });
      
      // Save "remember me" preference BEFORE signing in
      // This ensures the useAuth hook picks it up when exchanging tokens
      setRememberMePreference(rememberMe);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        logAuthEvent("login_failure", { email: validatedData.email });
        throw error;
      }

      // Check if email is verified for new accounts (created after 2026-01-09)
      // Existing accounts are grandfathered in
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email_verified, created_at")
          .eq("id", data.user.id)
          .single();

        const verificationCutoffDate = new Date("2026-01-09T00:00:00Z");
        const accountCreatedAt = profile?.created_at ? new Date(profile.created_at) : new Date(0);
        const isNewAccount = accountCreatedAt >= verificationCutoffDate;

        // Only require verification for NEW accounts that haven't verified
        if (isNewAccount && !profile?.email_verified) {
          await supabase.auth.signOut();
          
          const userEmail = data.user.email || email;
          const userName = data.user.user_metadata?.full_name || "User";
          
          toast.error("Please verify your email before signing in.");
          navigate(`/check-email?email=${encodeURIComponent(userEmail)}&uid=${encodeURIComponent(data.user.id)}&name=${encodeURIComponent(userName)}`);
          return;
        }

        logAuthEvent("login_success", { email: validatedData.email });
        toast.success("Logged in successfully!");
        const shouldRedirectHospital = localStorage.getItem("clinicalhours_hospital_redirect") === "true";
        localStorage.removeItem("clinicalhours_hospital_redirect");
        navigate(shouldRedirectHospital ? "/hospital/onboarding" : "/dashboard");
        return;
      }

      logAuthEvent("login_success", { email: validatedData.email });
      toast.success("Logged in successfully!");
      const shouldRedirectHospital2 = localStorage.getItem("clinicalhours_hospital_redirect") === "true";
      localStorage.removeItem("clinicalhours_hospital_redirect");
      navigate(shouldRedirectHospital2 ? "/hospital/onboarding" : "/dashboard");
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        // Generic error message to prevent information disclosure and email enumeration
        // Don't reveal if email exists or specific error details
        toast.error("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { email, origin: window.location.origin },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setResetEmailSent(true);
      toast.success("If an account exists, a password reset email will be sent.");
    } catch (error: unknown) {
      // Sanitize error message
      const errorMessage = error instanceof Error && (error.message?.includes("rate limit") || error.message?.includes("too many"))
        ? "Too many requests. Please wait a moment and try again."
        : "Failed to send reset email. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Show forgot password screen
  if (showForgotPassword) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />
        
        <div className="relative z-10 w-full max-w-md text-center space-y-6 bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-border/50">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          {resetEmailSent ? (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h1>
                <p className="text-muted-foreground">
                  We've sent a password reset link to <strong className="text-foreground">{email}</strong>
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to reset your password. If you don't see it, check your spam folder.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Forgot Password?</h1>
                <p className="text-muted-foreground">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>
              <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setShowForgotPassword(false);
              setResetEmailSent(false);
              setEmail("");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${authBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Back to Home Link */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Home</span>
      </Link>

      {/* Centered Card */}
      <div className="relative z-10 w-full max-w-md bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-border/50">
        {/* Logo and Branding */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={logo} alt="ClinicalHours" className="h-12 w-auto" />
            <h1 className="text-2xl font-heading">
              <span className="font-normal">Clinical</span><span className="font-bold">Hours</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your journey to clinical experience starts here
          </p>
        </div>

        {/* Quick Actions - Google & Guest at top */}
        <div className="space-y-3 mb-6">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base bg-background hover:bg-muted border-border"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            className="w-full h-12 text-base"
            onClick={handleGuestMode}
            disabled={loading || googleLoading}
          >
            <UserCircle className="mr-2 h-5 w-5" />
            Continue as Guest
          </Button>
        </div>

        {/* Hospital CTA */}
        <div className="bg-muted/30 border border-border/50 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-foreground mb-1">Hospital / Clinic?</p>
          <p className="text-xs text-muted-foreground mb-3">
            Create a hospital account to manage applications and recruit volunteers.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 text-sm gap-2"
            onClick={() => {
              localStorage.setItem("clinicalhours_hospital_redirect", "true");
              // Switch to signup tab or just let them use the existing auth
            }}
            asChild
          >
            <Link to="/auth?hospital=true">
              <Building2 className="h-4 w-4" />
              Create Hospital Account
            </Link>
          </Button>
        </div>

        <div className="relative my-6">
          <Separator className="bg-border/50" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
            or sign in with email
          </span>
        </div>

        {/* Auth Tabs */}
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    className="h-11 pr-10"
                  />
                  <div
                    onMouseEnter={() => setShowPassword(true)}
                    onMouseLeave={() => setShowPassword(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={loading || googleLoading}
                />
                <Label
                  htmlFor="remember-me"
                  className="text-sm font-normal text-muted-foreground cursor-pointer"
                >
                  Keep me signed in
                </Label>
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading || googleLoading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone">
                  Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading || googleLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading || googleLoading}
                    className="h-11 pr-10"
                  />
                  <div
                    onMouseEnter={() => setShowPassword(true)}
                    onMouseLeave={() => setShowPassword(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-3 pt-1">
                <Checkbox
                  id="email-opt-in"
                  checked={emailOptIn}
                  onCheckedChange={(checked) => setEmailOptIn(checked === true)}
                  disabled={loading || googleLoading}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="email-opt-in"
                  className="text-sm font-normal text-muted-foreground cursor-pointer leading-tight"
                >
                  Send me updates about new clinical opportunities
                </Label>
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading || googleLoading}>
                {loading ? "Creating account..." : "Sign Up"}
              </Button>
              
              <p className="text-xs text-muted-foreground text-center mt-3">
                By signing up, you agree to our{" "}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;
