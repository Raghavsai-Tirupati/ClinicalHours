import RichEmailDialog from './RichEmailDialog';
import type { StudentApplication } from '@/types/positions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalPageId: string;
  hospitalName?: string;
  senderEmail?: string | null;
  selectedApplicationIds: string[];
  applications: StudentApplication[];
}

/**
 * Drop-in replacement that delegates to the rich-text email composer.
 * Kept as a separate file so existing imports don't break.
 */
export default function EmailDialog(props: Props) {
  return <RichEmailDialog {...props} />;
}
