import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { logAuthEvent } from "@/lib/auditLogger";
import { trackLogin, trackSignup, trackEvent } from "@/lib/tracking";
import { setRememberMePreference, getRememberMePreference, useAuth } from "@/hooks/useAuth";
import { migrateGuestDataToUser } from "@/lib/guestMigration";
import { z } from "zod";
import { ArrowLeft, Mail, Loader2, Eye, UserCircle, Building2, Check, X } from "lucide-react";
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

const PasswordReq = ({ met, label }: { met: boolean; label: string }) => (
  <div className={`flex items-center gap-1.5 ${met ? "text-green-500" : "text-muted-foreground"}`}>
    {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    <span>{label}</span>
  </div>
);

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }).max(255),
  password: z.string().min(1, { message: "Please enter your password." }),
});

const signupSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }).max(255),
  password: z.string()
    .min(8, { message: "Password needs at least 8 characters with both letters and numbers." })
    .max(128)
    .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
      message: "Password needs at least 8 characters with both letters and numbers."
    }),
  fullName: z.string().trim().min(1, { message: "Full name is required." }).max(100).optional(),
  phone: z.string().max(20).optional().or(z.literal("")),
});

const Auth = () => {
  const navigate = useNavigate();
  const { enterGuestMode, isGuest } = useAuth();
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

  // Hospital signup fields
  const [isHospitalSignup, setIsHospitalSignup] = useState(false);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalWebsite, setHospitalWebsite] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalDescription, setHospitalDescription] = useState("");

  const handleGuestMode = () => {
    trackEvent("page_view", { action: "guest_mode_entered" });
    enterGuestMode();
    navigate("/dashboard");
  };

  // Check hospital account status and redirect accordingly
  const redirectByAccountType = async (userId: string) => {
    // Find owner memberships for this user
    const { data: members } = await supabase
      .from("hospital_members")
      .select("account_id")
      .eq("user_id", userId)
      .eq("role", "owner");

    if (!members?.length) {
      navigate("/dashboard");
      return;
    }

    const accountIds = members.map((m) => m.account_id);
    const { data: accounts } = await supabase
      .from("hospital_accounts")
      .select("account_status")
      .in("id", accountIds);

    const hasApproved = accounts?.some((a) => a.account_status === "approved");
    if (hasApproved) {
      navigate("/hospital-dashboard");
    } else {
      navigate("/pending-approval");
    }
  };

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
          window.history.replaceState(null, '', window.location.pathname);
          const userId = data.session.user.id;
          const convertedFromGuest = isGuest;
          trackLogin(userId, "google");
          await migrateGuestDataToUser(userId, { convertedFromGuest });
          await redirectByAccountType(userId);
          return;
        }
      }

      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userId = session.user.id;
        const convertedFromGuest = isGuest;
        await migrateGuestDataToUser(userId, { convertedFromGuest });
        await redirectByAccountType(userId);
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
      const validatedData = signupSchema.parse({ email, password, fullName, phone });
      
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

      // Supabase returns a user with empty identities when the email already exists
      // (instead of an error, for security). Detect this and give a helpful message.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        toast.error("An account with this email already exists. Try signing in or resetting your password.");
        return;
      }

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

        if (isHospitalSignup && hospitalName.trim()) {
          try {
            // 1) Create the hospital record
            const { data: hospital, error: hospitalInsertError } = await supabase
              .from("hospitals")
              .insert({
                name: hospitalName.trim(),
                address: hospitalAddress.trim() || null,
                website: hospitalWebsite.trim() || null,
              })
              .select("id")
              .single();

            if (hospitalInsertError || !hospital) {
              console.error("Hospital insert failed:", hospitalInsertError);
              toast.error("Account created but hospital profile failed to save. Please contact support@clinicalhours.org.");
              return;
            }

            // 2) Create the hospital account (pending admin approval)
            const { data: account, error: accountError } = await supabase
              .from("hospital_accounts")
              .insert({
                hospital_id: hospital.id,
                account_status: "pending",
                contact_email: validatedData.email,
                contact_phone: validatedData.phone || null,
                description: hospitalDescription.trim() || null,
              })
              .select("id")
              .single();

            if (accountError || !account) {
              console.error("Hospital account insert failed:", accountError);
              toast.error("Account created but hospital profile failed to save. Please contact support@clinicalhours.org.");
              return;
            }

            // 3) Add the user as the owner of this hospital account
            const { error: memberError } = await supabase
              .from("hospital_members")
              .insert({
                account_id: account.id,
                user_id: data.user.id,
                role: "owner",
              });

            if (memberError) {
              console.error("Hospital member insert failed:", memberError);
              toast.error("Account created but hospital profile failed to save. Please contact support@clinicalhours.org.");
              return;
            }

            // 4) Mark email as verified so hospital users skip verification
            await supabase
              .from("profiles")
              .update({ email_verified: true })
              .eq("id", data.user.id);
          } catch (hospitalFlowError) {
            console.error("Hospital signup flow failed:", hospitalFlowError);
            toast.error("Account created but hospital profile failed to save. Please contact support@clinicalhours.org.");
            return;
          }
        }
      }

      if (data.user) {
        const userId = data.user.id;
        const convertedFromGuest = isGuest;
        logAuthEvent("signup", { email: validatedData.email });
        trackSignup(userId, isHospitalSignup ? "hospital" : "email");
        await migrateGuestDataToUser(userId, { convertedFromGuest });

        if (isHospitalSignup) {
          // Hospital accounts: skip email verification, go straight to pending approval
          toast.success("Account created! Your hospital account is pending admin approval.");
          await redirectByAccountType(userId);
        } else {
          await supabase
            .from("profiles")
            .update({ dashboard_tutorial_complete: convertedFromGuest })
            .eq("id", userId);
          // Student accounts: send verification email but allow immediate use
          await sendVerificationEmail(
            userId,
            validatedData.email,
            validatedData.fullName || "User"
          );
          toast.success("Account created! You can start exploring. Verify your email within 24 hours.");
          navigate(`/check-email?email=${encodeURIComponent(validatedData.email)}&uid=${encodeURIComponent(userId)}&name=${encodeURIComponent(validatedData.fullName || "User")}`);
        }
      }
    } catch (error: unknown) {
      console.error("Sign up error:", error);

      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
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

        const lowerMsg = errorMsg.toLowerCase();

        if (lowerMsg.includes('already') || lowerMsg.includes('registered') || lowerMsg.includes('exists')) {
          toast.error("An account with this email already exists. Try signing in or resetting your password.");
        } else if (lowerMsg.includes('password') || lowerMsg.includes('length') || lowerMsg.includes('character')) {
          toast.error("Password needs at least 8 characters with both letters and numbers.");
        } else if (lowerMsg.includes('rate') || lowerMsg.includes('too many')) {
          toast.error("Too many attempts. Please wait a moment and try again.");
        } else if (errorMsg) {
          toast.error(errorMsg);
        } else {
          toast.error("Something went wrong creating your account. Please try again.");
        }
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
      const validatedData = loginSchema.parse({ email, password });
      
      setRememberMePreference(rememberMe);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        logAuthEvent("login_failure", { email: validatedData.email });
        throw error;
      }

      if (data.user) {
        const userId = data.user.id;
        const convertedFromGuest = isGuest;
        logAuthEvent("login_success", { email: validatedData.email });
        trackLogin(userId, "email");
        toast.success("Welcome back!");
        await migrateGuestDataToUser(userId, { convertedFromGuest });
        await redirectByAccountType(userId);
        return;
      }

      logAuthEvent("login_success", { email: validatedData.email });
      toast.success("Welcome back!");
      if (data.user) {
        const userId = data.user.id;
        const convertedFromGuest = isGuest;
        await migrateGuestDataToUser(userId, { convertedFromGuest });
        await redirectByAccountType(userId);
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Sign in error:", error);
        const errorMsg = error instanceof Error ? error.message.toLowerCase() : "";

        if (errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid_credentials')) {
          toast.error("Incorrect email or password. Try again or reset your password.");
        } else if (errorMsg.includes('rate') || errorMsg.includes('too many')) {
          toast.error("Too many login attempts. Please wait a moment and try again.");
        } else if (errorMsg.includes('email not confirmed')) {
          toast.error("Please verify your email before signing in. Check your inbox for the verification link.");
        } else {
          toast.error("Something went wrong signing in. Please try again.");
        }
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
            Try the hour tracker first (no signup)
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
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
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
              {/* Hospital toggle */}
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <Checkbox
                  id="hospital-toggle"
                  checked={isHospitalSignup}
                  onCheckedChange={(checked) => setIsHospitalSignup(checked === true)}
                  disabled={loading || googleLoading}
                />
                <Label
                  htmlFor="hospital-toggle"
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  I'm registering as a hospital / clinical site
                </Label>
              </div>

              {/* Hospital-specific fields */}
              {isHospitalSignup && (
                <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/30">
                  <div className="space-y-2">
                    <Label htmlFor="hospital-name">Hospital / Facility Name</Label>
                    <Input
                      id="hospital-name"
                      type="text"
                      placeholder="City General Hospital"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      required={isHospitalSignup}
                      disabled={loading || googleLoading}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hospital-website">
                      Website <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="hospital-website"
                      type="url"
                      placeholder="https://www.hospital.org"
                      value={hospitalWebsite}
                      onChange={(e) => setHospitalWebsite(e.target.value)}
                      disabled={loading || googleLoading}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hospital-address">
                      Address <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="hospital-address"
                      type="text"
                      placeholder="123 Medical Center Dr, City, State"
                      value={hospitalAddress}
                      onChange={(e) => setHospitalAddress(e.target.value)}
                      disabled={loading || googleLoading}
                      className="h-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="signup-name">
                  {isHospitalSignup ? "Contact Person Name" : "Full Name"}
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder={isHospitalSignup ? "Dr. Jane Smith" : "John Doe"}
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
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <PasswordReq met={password.length >= 8} label="At least 8 characters" />
                    <PasswordReq met={/[a-zA-Z]/.test(password)} label="Contains a letter" />
                    <PasswordReq met={/[0-9]/.test(password)} label="Contains a number" />
                  </div>
                )}
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
                {loading ? "Creating account..." : isHospitalSignup ? "Register Hospital" : "Sign Up"}
              </Button>

              {isHospitalSignup && (
                <p className="text-xs text-muted-foreground text-center">
                  Hospital accounts require admin approval before access is granted.
                </p>
              )}
              
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
