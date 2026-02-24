import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalAccount } from "@/hooks/useHospitalAccount";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, XCircle, Loader2, LogOut, Building2, Mail } from "lucide-react";
import logo from "@/assets/logo.png";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { hospitalAccount, isLoading: hospitalLoading } = useHospitalAccount();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!hospitalLoading && !hospitalAccount) {
      navigate("/dashboard");
      return;
    }
    if (!hospitalLoading && hospitalAccount?.account_status === "approved") {
      navigate("/hospital-dashboard");
      return;
    }
  }, [authLoading, user, hospitalLoading, hospitalAccount, navigate]);

  if (authLoading || hospitalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const isRejected = hospitalAccount?.account_status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={logo} alt="ClinicalHours" className="h-10 w-auto" />
            <h1 className="text-xl font-heading">
              <span className="font-normal">Clinical</span>
              <span className="font-bold">Hours</span>
            </h1>
          </div>
        </div>

        <Card className="border-border/50">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4">
              {isRejected ? (
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl">
              {isRejected ? "Account Not Approved" : "Account Pending Approval"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isRejected
                ? "Your hospital account application was not approved."
                : "Your hospital account is awaiting admin review."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Hospital info */}
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{hospitalAccount?.hospital_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{hospitalAccount?.contact_email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge
                  variant={isRejected ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {isRejected ? "Rejected" : "Pending Review"}
                </Badge>
              </div>
            </div>

            {/* Rejection note */}
            {isRejected && hospitalAccount?.admin_note && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">
                  Admin Note
                </p>
                <p className="text-sm text-foreground">{hospitalAccount.admin_note}</p>
              </div>
            )}

            {/* Info message */}
            {!isRejected && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-sm text-muted-foreground">
                  Our team reviews new hospital registrations to ensure quality and safety for our students.
                  You'll receive an email once your account has been reviewed.
                </p>
              </div>
            )}

            {isRejected && (
              <p className="text-sm text-muted-foreground text-center">
                If you believe this was an error, please contact us at{" "}
                <a href="mailto:support@clinicalhours.org" className="text-primary hover:underline">
                  support@clinicalhours.org
                </a>
              </p>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await signOut();
                navigate("/auth");
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
