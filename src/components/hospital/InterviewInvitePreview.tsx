import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicName: string;
  bookingUrl: string;
  adminName?: string;
  recipientCount: number;
}

/**
 * Branded preview that mirrors the backend interview-invite email template.
 * Renders placeholder tokens so admins can validate the layout before sending.
 */
export default function InterviewInvitePreview({
  open,
  onOpenChange,
  clinicName,
  bookingUrl,
  adminName = 'The Team',
  recipientCount,
}: Props) {
  const displayUrl = bookingUrl || 'https://calendly.com/your-clinic';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Interview invite email preview</DialogTitle>
        </DialogHeader>

        {/* Chrome bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Interview Invite Preview
          </span>
          <span className="text-[11px] text-muted-foreground">
            to {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Email render area — white background to mimic inbox */}
        <div className="bg-white" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
          {/* ─── Gradient Header ─── */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f87171 0%, #a78bfa 50%, #60a5fa 100%)',
              padding: '48px 24px 40px',
              textAlign: 'center' as const,
            }}
          >
            <h1 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              You've been invited to interview
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '15px', margin: 0 }}>
              {clinicName} · Clinical Rotation
            </p>
          </div>

          {/* ─── Body ─── */}
          <div style={{ padding: '36px 32px' }}>
            {/* Greeting */}
            <p style={{ fontSize: '16px', color: '#1a1a1a', margin: '0 0 16px', lineHeight: 1.6 }}>
              Hi <span style={{ fontWeight: 600, color: '#7c3aed' }}>{'{{first_name}}'}</span>,
            </p>
            <p style={{ fontSize: '15px', color: '#374151', margin: '0 0 24px', lineHeight: 1.6 }}>
              We're excited to let you know that <strong>{clinicName}</strong> has reviewed your application
              and would like to invite you to schedule an interview.
            </p>

            {/* ─── Interview Details Card ─── */}
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '28px',
              }}
            >
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 12px' }}>
                Interview Details
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                <tbody>
                  <tr>
                    <td style={{ fontSize: '13px', color: '#6b7280', padding: '4px 0', width: '110px' }}>Position</td>
                    <td style={{ fontSize: '14px', color: '#111827', fontWeight: 500, padding: '4px 0' }}>
                      <span style={{ color: '#7c3aed' }}>{'{{position_name}}'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontSize: '13px', color: '#6b7280', padding: '4px 0' }}>Clinic</td>
                    <td style={{ fontSize: '14px', color: '#111827', fontWeight: 500, padding: '4px 0' }}>
                      <span style={{ color: '#7c3aed' }}>{'{{clinic_name}}'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontSize: '13px', color: '#6b7280', padding: '4px 0' }}>Format</td>
                    <td style={{ fontSize: '14px', color: '#111827', fontWeight: 500, padding: '4px 0' }}>Self-schedule via link below</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ─── CTA Button ─── */}
            <div style={{ textAlign: 'center' as const, margin: '0 0 16px' }}>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 600,
                  padding: '14px 40px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Schedule your slot →
              </a>
            </div>

            {/* URL fallback */}
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center' as const, margin: '0 0 28px', wordBreak: 'break-all' as const }}>
              Or copy this link: <span style={{ color: '#6366f1' }}>{'{{booking_url}}'}</span>
            </p>

            {/* Sign-off */}
            <p style={{ fontSize: '15px', color: '#374151', margin: '0 0 4px', lineHeight: 1.6 }}>
              Best of luck,
            </p>
            <p style={{ fontSize: '15px', color: '#374151', margin: '0 0 0', lineHeight: 1.6, fontWeight: 600 }}>
              <span style={{ color: '#7c3aed' }}>{'{{admin_name}}'}</span> — {clinicName}
            </p>
          </div>

          {/* ─── Footer ─── */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '20px 32px', textAlign: 'center' as const }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
              Sent via ClinicalHours · clinicalhours.org
            </p>
          </div>
        </div>

        {/* ─── Compatibility Notes ─── */}
        <div className="px-4 py-3 bg-muted/40 border-t border-border/40 space-y-1">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              <strong>Outlook:</strong> Uses solid fallback colors for gradient areas.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              <strong>CTA button:</strong> Includes VML fallback for Outlook rendering.
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground/60 pl-5">
            Purple tokens (e.g. {'{{first_name}}'}) are replaced per-recipient at send time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
