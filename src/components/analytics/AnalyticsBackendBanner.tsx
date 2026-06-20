import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AnalyticsBackendBannerProps {
  show?: boolean;
}

export default function AnalyticsBackendBanner({ show }: AnalyticsBackendBannerProps) {
  if (!show) return null;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="py-3 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Database migrations pending
          </p>
          <p className="text-muted-foreground">
            Apply migrations via Lovable using{' '}
            <code className="text-[10px] bg-muted px-1 rounded">docs/LOVABLE_ANALYTICS_BACKEND_PROMPT.md</code>
            {' '}— run{' '}
            <code className="text-[10px] bg-muted px-1 rounded">20260618100000_admin_analytics.sql</code>,{' '}
            <code className="text-[10px] bg-muted px-1 rounded">20260618110000_fix_admin_os_rls.sql</code>, and{' '}
            <code className="text-[10px] bg-muted px-1 rounded">20260619100000_student_analytics_hub.sql</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
