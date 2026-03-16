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
import { UserCircle, AlertCircle } from "lucide-react";

interface ProfileGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingFields: string[];
  action?: string; // e.g., "leave a review", "ask a question"
}

export function ProfileGate({
  open,
  onOpenChange,
  missingFields,
  action = "participate",
}: ProfileGateProps) {
  const navigate = useNavigate();

  const handleCompleteProfile = () => {
    onOpenChange(false);
    navigate("/settings");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle>Complete Your Profile</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            To {action}, please complete your profile first. This helps other students
            know who's sharing their experiences.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Missing required fields:</p>
              <ul className="text-sm text-muted-foreground space-y-0.5">
                {missingFields.map((field) => (
                  <li key={field}>• {field}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCompleteProfile}>
            Complete Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
