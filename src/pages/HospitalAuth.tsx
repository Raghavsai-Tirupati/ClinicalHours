import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Building2, Loader2, Eye, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { setRememberMePreference, getRememberMePreference, useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";
import logo from "@/assets/logo.png";
import authBackground from "@/assets/auth-background.png";

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters with letters and numbers" })
    .max(128)
    .refine((val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val), {
      message: "Password must contain both letters and numbers",
    }),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100).optional(),
});

export default function HospitalAuth() {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const { member, loading: memberLoading } = useHospitalMember();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const isSubmittingRef = useRef(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isReady || memberLoading) return;
    if (user) {
      navigate(member ? "/hospital/portal" : "/hospital/onboarding");
    }
  }, [isReady, user, member, memberLoading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const validated = authSchema.parse({ email, password, fullName });

      // Call hospital-signup directly (bypass CSRF since user isn't authenticated yet)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/hospital-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey,
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          email: validated.email,
          password: validated.password,
          fullName: validated.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Signup failed");

      // Now sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (signInError) throw signInError;

      toast.success("Account created! Setting up your hospital…");
      navigate("/hospital/onboarding");
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        const msg = err instanceof Error ? err.message : "Unable to create account.";
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const validated = authSchema.parse({ email, password });
      setRememberMePreference(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast.success("Signed in!");
      // Routing handled by the useEffect above once user state updates
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        toast.error("Invalid email or password.");
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email."); return; }
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email, origin: window.location.origin },
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast.success("If an account exists, a reset email will be sent.");
    } catch {
      toast.error("Failed to send reset email.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // ── Forgot password screen ──
  if (showForgotPassword) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ backgroundImage: `url(${authBackground})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 w-full max-w-md text-center space-y-6 bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-border/50">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          {resetEmailSent ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">Check Your Email</h1>
              <p className="text-muted-foreground">We've sent a password reset link to <strong className="text-foreground">{email}</strong></p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">Forgot Password?</h1>
              <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>{loading ? "Sending…" : "Send Reset Link"}</Button>
              </form>
            </>
          )}
          <Button variant="ghost" onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  // ── Main auth page ──
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ backgroundImage: `url(${authBackground})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <Link to="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/80 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Home</span>
      </Link>

      <div className="relative z-10 w-full max-w-md bg-card/95 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-border/50">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <img src={logo} alt="ClinicalHours" className="h-8 w-auto" />
                <span className="text-lg font-heading font-bold">for Hospitals</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage volunteer applications and recruit clinical students
          </p>
        </div>

        <Separator className="mb-6 bg-border/50" />

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="h-signin-email">Email</Label>
                <Input id="h-signin-email" type="email" placeholder="admin@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="h-11" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="h-signin-password">Password</Label>
                  <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-primary hover:underline">Forgot?</button>
                </div>
                <div className="relative">
                  <Input id="h-signin-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="h-11 pr-10" />
                  <div onMouseEnter={() => setShowPassword(true)} onMouseLeave={() => setShowPassword(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…</> : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="h-signup-name">Full Name</Label>
                <Input id="h-signup-name" type="text" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={loading} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-signup-email">Hospital Email</Label>
                <Input id="h-signup-email" type="email" placeholder="admin@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-signup-password">Password</Label>
                <div className="relative">
                  <Input id="h-signup-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="h-11 pr-10" />
                  <div onMouseEnter={() => setShowPassword(true)} onMouseLeave={() => setShowPassword(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</> : "Create Hospital Account"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                No email verification needed — instant access.
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Are you a student?{" "}
            <Link to="/auth" className="text-primary hover:underline font-medium">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
