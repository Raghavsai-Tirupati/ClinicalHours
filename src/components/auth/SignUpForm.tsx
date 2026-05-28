import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Building2 } from "lucide-react";
import type { HospitalOption } from "./types";
import HospitalSignupSearch from "./HospitalSignupSearch";
import PasswordRequirements from "./PasswordRequirements";

interface SignUpFormProps {
  // Form field values
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  fullName: string;
  onFullNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  emailOptIn: boolean;
  onEmailOptInChange: (value: boolean) => void;
  emailPreFilled: boolean;
  onEmailPreFilledChange: (value: boolean) => void;

  // Hospital signup
  isHospitalSignup: boolean;
  onIsHospitalSignupChange: (value: boolean) => void;
  selectedOpportunity: HospitalOption | null;
  hospitalSearchQuery: string;
  onHospitalSearchQueryChange: (value: string) => void;
  hospitalSearchResults: HospitalOption[];
  hospitalSearchLoading: boolean;
  showSearchResults: boolean;
  onShowSearchResults: (show: boolean) => void;
  debouncedHospitalSearch: string;
  onHospitalSelect: (hospital: HospitalOption) => void;
  onHospitalClear: () => void;

  // Submission
  loading: boolean;
  googleLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const SignUpForm = ({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  fullName,
  onFullNameChange,
  phone,
  onPhoneChange,
  showPassword,
  onToggleShowPassword,
  emailOptIn,
  onEmailOptInChange,
  emailPreFilled,
  onEmailPreFilledChange,
  isHospitalSignup,
  onIsHospitalSignupChange,
  selectedOpportunity,
  hospitalSearchQuery,
  onHospitalSearchQueryChange,
  hospitalSearchResults,
  hospitalSearchLoading,
  showSearchResults,
  onShowSearchResults,
  debouncedHospitalSearch,
  onHospitalSelect,
  onHospitalClear,
  loading,
  googleLoading,
  onSubmit,
}: SignUpFormProps) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Hospital toggle */}
      <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <Checkbox
          id="hospital-toggle"
          checked={isHospitalSignup}
          onCheckedChange={(checked) => onIsHospitalSignupChange(checked === true)}
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

      {/* Hospital search — select from opportunities */}
      {isHospitalSignup && (
        <HospitalSignupSearch
          hospitalSearchQuery={hospitalSearchQuery}
          onSearchQueryChange={onHospitalSearchQueryChange}
          hospitalSearchResults={hospitalSearchResults}
          hospitalSearchLoading={hospitalSearchLoading}
          showSearchResults={showSearchResults}
          onShowSearchResults={onShowSearchResults}
          selectedOpportunity={selectedOpportunity}
          debouncedHospitalSearch={debouncedHospitalSearch}
          onSelect={onHospitalSelect}
          onClear={onHospitalClear}
          disabled={loading || googleLoading}
        />
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
          onChange={(e) => onFullNameChange(e.target.value)}
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
          onChange={(e) => {
            onEmailChange(e.target.value);
            if (emailPreFilled) onEmailPreFilledChange(false);
          }}
          required
          disabled={loading || googleLoading}
          className="h-11"
        />
        {emailPreFilled && (
          <p className="text-xs text-green-600">Email pre-filled from your hospital page</p>
        )}
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
          onChange={(e) => onPhoneChange(e.target.value)}
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
        <PasswordRequirements password={password} />
      </div>
      <div className="flex items-start space-x-3 pt-1">
        <Checkbox
          id="email-opt-in"
          checked={emailOptIn}
          onCheckedChange={(checked) => onEmailOptInChange(checked === true)}
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
      <Button
        type="submit"
        className="w-full h-11 text-base"
        disabled={loading || googleLoading || (isHospitalSignup && !selectedOpportunity)}
      >
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
  );
};

export default SignUpForm;
