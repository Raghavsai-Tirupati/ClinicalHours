import { Check, X } from "lucide-react";

const PasswordReq = ({ met, label }: { met: boolean; label: string }) => (
  <div className={`flex items-center gap-1.5 ${met ? "text-green-500" : "text-muted-foreground"}`}>
    {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    <span>{label}</span>
  </div>
);

interface PasswordRequirementsProps {
  password: string;
}

/**
 * Renders the password strength requirement checklist.
 * Only shows when password.length > 0 (caller is responsible for that guard,
 * or the component can be conditionally rendered by the parent).
 */
const PasswordRequirements = ({ password }: PasswordRequirementsProps) => {
  if (password.length === 0) return null;

  return (
    <div className="space-y-1 text-xs">
      <PasswordReq met={password.length >= 8} label="At least 8 characters" />
      <PasswordReq met={/[a-zA-Z]/.test(password)} label="Contains a letter" />
      <PasswordReq met={/[0-9]/.test(password)} label="Contains a number" />
    </div>
  );
};

export default PasswordRequirements;
