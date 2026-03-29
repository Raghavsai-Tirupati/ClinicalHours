import {
  Mail,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { EmailSendLog } from './types';

interface SendHistoryProps {
  logs: EmailSendLog[];
  loading: boolean;
}

const STATUS_CONFIG = {
  sent: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    label: 'Sent',
  },
  partial: {
    icon: AlertCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    label: 'Partial',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/15 text-red-400 border-red-500/30',
    label: 'Failed',
  },
};

export default function SendHistory({ logs, loading }: SendHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          No emails sent from templates yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {logs.length} send{logs.length !== 1 ? 's' : ''} logged
      </p>
      {logs.map((log) => {
        const config =
          STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sent;
        const StatusIcon = config.icon;
        const meta = log.metadata as Record<string, unknown> | null;

        return (
          <div key={log.id} className="rounded-lg border border-border/50 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {log.template_name || 'Custom Email'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{log.subject}</p>
              </div>
              <Badge variant="outline" className={`text-xs ${config.bgColor}`}>
                <StatusIcon className={`h-3 w-3 mr-1 ${config.color}`} />
                {config.label}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>
                {log.recipient_count} recipient{log.recipient_count !== 1 ? 's' : ''}
              </span>
              <span>
                {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
              <span>by {log.sent_by}</span>
            </div>

            {/* Show first few recipient emails */}
            {log.recipient_emails && log.recipient_emails.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {log.recipient_emails.slice(0, 5).map((email) => (
                  <Badge
                    key={email}
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    {email}
                  </Badge>
                ))}
                {log.recipient_emails.length > 5 && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    +{log.recipient_emails.length - 5} more
                  </Badge>
                )}
              </div>
            )}

            {/* Error details */}
            {meta?.errors && Array.isArray(meta.errors) && (
              <div className="text-xs text-red-400 mt-1">
                {(meta.errors as string[]).slice(0, 3).map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
