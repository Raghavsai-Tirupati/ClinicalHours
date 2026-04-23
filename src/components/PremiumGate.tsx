import { useState } from "react";
import { Link } from "react-router-dom";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { useAuth } from "@/hooks/useAuth";
import { useEmailVerified } from "@/hooks/useEmailVerified";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { VerificationGate } from "@/components/VerificationGate";

interface PremiumGateProps {
  children: React.ReactNode;
  featureName?: string;
  description?: string;
  showPreview?: boolean;
  previewContent?: React.ReactNode;
}

export function PremiumGate({
  children,
  featureName = "This feature",
  description = "Upgrade to ClinicalHours Premium to unlock this and all other premium tools.",
  showPreview = false,
  previewContent,
}: PremiumGateProps) {
  const { isPremium, isLoading } = usePremiumStatus();
  const { user } = useAuth();
  const { needsVerification } = useEmailVerified();
  const [verificationGateOpen, setVerificationGateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {showPreview && previewContent && (
        <div className="pointer-events-none select-none opacity-40 blur-[2px]">
          {previewContent}
        </div>
      )}
      <div className={`${showPreview ? 'absolute inset-0' : ''} flex items-center justify-center`}>
        <div className="max-w-md text-center px-6 py-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {featureName} is a Premium Feature
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {description}
          </p>
          {user && needsVerification ? (
            <>
              <Button className="gap-2" onClick={() => setVerificationGateOpen(true)}>
                <Sparkles className="h-4 w-4" />
                Upgrade — $9.99/month
              </Button>
            </>
          ) : (
            <Button asChild className="gap-2">
              <Link to={user ? "/premium/purchase" : "/auth"}>
                <Sparkles className="h-4 w-4" />
                {user ? "Upgrade — $9.99/month" : "Sign Up to Get Started"}
              </Link>
            </Button>
          )}
          <VerificationGate
            open={verificationGateOpen}
            onOpenChange={setVerificationGateOpen}
            action="purchase Premium"
          />
        </div>
      </div>
    </div>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
      <Sparkles className="h-3 w-3" />
      Premium
    </span>
  );
}

export function UpgradeCTA({ message = "Unlock all premium features" }: { message?: string }) {
  const { user } = useAuth();
  const { needsVerification } = useEmailVerified();
  const [verificationGateOpen, setVerificationGateOpen] = useState(false);

  const handleUpgradeClick = (e: React.MouseEvent) => {
    if (user && needsVerification) {
      e.preventDefault();
      setVerificationGateOpen(true);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{message}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-powered tools, unlimited search, hour tracking, and more.
          </p>
        </div>
        {user && needsVerification ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={() => setVerificationGateOpen(true)}
          >
            Upgrade
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" asChild>
            <Link to={user ? "/premium/purchase" : "/auth"}>
              Upgrade
            </Link>
          </Button>
        )}
      </div>
      <VerificationGate
        open={verificationGateOpen}
        onOpenChange={setVerificationGateOpen}
        action="purchase Premium"
      />
    </div>
  );
}
