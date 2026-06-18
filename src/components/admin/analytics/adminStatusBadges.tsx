import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type AttentionLevel = 'green' | 'yellow' | 'red' | 'gray';

const ATTENTION_STYLES: Record<AttentionLevel, string> = {
  green: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  yellow: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  red: 'bg-red-500/15 text-red-600 border-red-500/30',
  gray: 'bg-muted text-muted-foreground border-border',
};

const ATTENTION_LABELS: Record<AttentionLevel, string> = {
  green: 'Active',
  yellow: 'Review',
  red: 'At risk',
  gray: 'Inactive',
};

export function AttentionBadge({
  level,
  className,
}: {
  level: AttentionLevel;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', ATTENTION_STYLES[level], className)}>
      {ATTENTION_LABELS[level]}
    </Badge>
  );
}

export function ApplicationStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const style =
    normalized === 'accepted'
      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
      : normalized === 'rejected'
        ? 'bg-red-500/15 text-red-600 border-red-500/30'
        : normalized === 'interview' || normalized === 'under_review'
          ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
          : 'bg-muted text-muted-foreground border-border';

  return (
    <Badge variant="outline" className={cn('text-[10px] capitalize', style)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export function EventTypeBadge({ type }: { type: string }) {
  const label = type.replace(/_/g, ' ');
  const style =
    type === 'login' || type === 'signup'
      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
      : type.includes('application') || type.includes('status')
        ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
        : type.includes('note') || type.includes('email')
          ? 'bg-purple-500/15 text-purple-600 border-purple-500/30'
          : 'bg-muted text-muted-foreground border-border';

  return (
    <Badge variant="outline" className={cn('text-[10px] capitalize shrink-0', style)}>
      {label}
    </Badge>
  );
}
