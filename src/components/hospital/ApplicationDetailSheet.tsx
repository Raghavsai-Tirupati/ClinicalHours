import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicantReviewPanel, { getApplicantNameForPanel } from '@/components/hospital/ApplicantReviewPanel';
import { useAutoMarkApplicationUnderReview } from '@/hooks/useAutoMarkApplicationUnderReview';

interface Props {
  application: StudentApplication | null;
  onClose: () => void;
  onStatusChange: (appId: string, status: ApplicationStatus) => void | Promise<void>;
  onNoteSaved: () => void;
  onApplicationPatched: (appId: string, patch: Partial<StudentApplication>) => void;
}

export default function ApplicationDetailSheet({
  application,
  onClose,
  onStatusChange,
  onNoteSaved,
  onApplicationPatched,
}: Props) {
  const name = application ? getApplicantNameForPanel(application) : '';

  const autoReviewing = useAutoMarkApplicationUnderReview(application, !!application, onApplicationPatched);

  return (
    <Sheet open={!!application} onOpenChange={() => onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto border-border/50 bg-background">
        {application && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">{name}</SheetTitle>
            </SheetHeader>
            <ApplicantReviewPanel
              application={application}
              onStatusChange={onStatusChange}
              onNoteSaved={onNoteSaved}
              showHeaderAvatar
              autoReviewing={autoReviewing}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
