import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Stethoscope, Heart, Activity } from "lucide-react";
import logo from "@/assets/logo.png";

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100),
  fullName: z.string().trim().min(1, { message: "Full name is required" }).max(100).optional(),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password, fullName });
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: validatedData.fullName,
          },
        },
      });

      if (error) throw error;

      toast.success("Account created! You can now log in.");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Error creating account");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = authSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast.success("Logged in successfully!");
      navigate("/");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Error signing in");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent">
        {/* Decorative floating elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-20 h-20 rounded-full bg-background/10 animate-float" />
          <div className="absolute top-40 right-20 w-32 h-32 rounded-full bg-background/5 animate-float-slow" />
          <div className="absolute bottom-32 left-20 w-16 h-16 rounded-full bg-background/10 animate-float" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-20 right-10 w-24 h-24 rounded-full bg-background/5 animate-float-slow" style={{ animationDelay: "0.5s" }} />
          
          {/* Decorative icons */}
          <Stethoscope className="absolute top-1/4 right-1/4 w-12 h-12 text-background/20 animate-float" style={{ animationDelay: "0.3s" }} />
          <Heart className="absolute bottom-1/3 left-1/4 w-10 h-10 text-background/15 animate-float-slow" style={{ animationDelay: "0.7s" }} />
          <Activity className="absolute top-1/2 right-1/3 w-14 h-14 text-background/10 animate-float" style={{ animationDelay: "1.2s" }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <h1 className="text-4xl xl:text-5xl font-bold text-primary-foreground mb-6">
            ClinicalHours
          </h1>
          <p className="text-xl xl:text-2xl text-primary-foreground/90 mb-4 font-medium">
            Find Your Path to Clinical Experience
          </p>
          <p className="text-primary-foreground/70 text-lg max-w-md">
            Discover, track, and connect with clinical volunteering opportunities across the nation. Your journey to medical school starts here.
          </p>
          
          {/* Stats or features */}
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>1000+ Clinical Opportunities</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>Track Your Applications</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-primary-foreground/60" />
              <span>Community Reviews & Insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 bg-background">
        {/* Back to Home Link */}
        <Link 
          to="/" 
          className="absolute top-6 left-6 lg:left-auto lg:right-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Home</span>
        </Link>

        <div className="w-full max-w-md mx-auto">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <img src={logo} alt="ClinicalHours" className="h-16 w-auto mx-auto mb-4" />
            <p className="text-muted-foreground">
              Connect with clinical opportunities
            </p>
          </div>

          {/* Mobile branding banner */}
          <div className="lg:hidden mb-8 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-center text-primary font-medium">
              Your journey to medical school starts here
            </p>
          </div>

          {/* Auth Tabs */}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
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
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-4">
                  By signing up, you agree to our{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms & Conditions
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
    </div>
  );
};

export default Auth;
