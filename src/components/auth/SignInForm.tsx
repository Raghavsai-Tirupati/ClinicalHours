import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye } from "lucide-react";

interface SignInFormProps {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  loading: boolean;
  googleLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  authError?: string;
}

const SignInForm = ({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  rememberMe,
  onRememberMeChange,
  loading,
  googleLoading,
  onSubmit,
  onForgotPassword,
  authError,
}: SignInFormProps) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
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
            onClick={onForgotPassword}
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
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            disabled={loading || googleLoading}
            className="h-11 pr-10"
          />
          <button
            type="button"
            onClick={onToggleShowPassword}
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
          onCheckedChange={(checked) => onRememberMeChange(checked === true)}
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
      {authError && (
        <p className="mt-2 text-sm text-destructive font-medium" role="alert">
          {authError}
        </p>
      )}
    </form>
  );
};

export default SignInForm;
