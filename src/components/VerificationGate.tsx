import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, AlertTriangle } from "lucide-react";

interface VerificationGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: string; // e.g., "add opportunities", "use premium features", "purchase premium"
}

export function VerificationGate({
  open,
  onOpenChange,
  action = "use this feature",
}: VerificationGateProps) {
  const navigate = useNavigate();

  const handleVerify = () => {
    onOpenChange(false);
    navigate("/check-email");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle>Verify Your Email</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            To {action}, please verify your email address first. We sent you a verification link when you signed up.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Verify within 24 hours</strong> or your account will be deleted. Check your inbox for the verification link.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleVerify}>
            Go to Verification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
