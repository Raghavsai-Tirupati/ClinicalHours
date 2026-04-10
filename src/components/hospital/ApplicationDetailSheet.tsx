import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
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
      <SheetContent className="sm:max-w-lg overflow-y-auto border-border/50 bg-background pt-10">
        {application && (
          <>
            <SheetTitle className="sr-only">{name}</SheetTitle>
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
