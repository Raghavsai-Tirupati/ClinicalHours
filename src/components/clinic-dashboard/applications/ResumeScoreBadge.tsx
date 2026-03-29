import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ResumeScoreBadgeProps {
  score: number | null | undefined;
  size?: 'sm' | 'md';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 60) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  if (score >= 40) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-400 border-red-500/30';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Partial match';
  return 'Low match';
}

export default function ResumeScoreBadge({ score, size = 'sm' }: ResumeScoreBadgeProps) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;

  const colorClass = getScoreColor(score);
  const label = getScoreLabel(score);
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${colorClass} ${textSize} tabular-nums cursor-default border`}
          >
            {score}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{label} — {score}% keyword overlap</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
