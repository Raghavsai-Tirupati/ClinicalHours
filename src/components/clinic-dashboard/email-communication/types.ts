export type TemplateCategory = 'accepted' | 'rejected' | 'waitlisted' | 'on_call' | 'onboarding';

export interface EmailTemplate {
  id: string;
  clinic_id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSendLog {
  id: string;
  clinic_id: string;
  template_id: string | null;
  template_name: string | null;
  subject: string;
  recipient_count: number;
  recipient_emails: string[];
  sent_by: string;
  status: 'sent' | 'partial' | 'failed';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, string> = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
  on_call: 'On Call',
  onboarding: 'Onboarding',
};

export const TEMPLATE_CATEGORY_COLORS: Record<TemplateCategory, string> = {
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  waitlisted: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  on_call: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  onboarding: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

export const TEMPLATE_VARIABLES = [
  { key: '{{name}}', label: 'Name' },
  { key: '{{role}}', label: 'Role' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{shift}}', label: 'Shift' },
];

export const SAMPLE_DATA: Record<string, string> = {
  '{{name}}': 'Jane Doe',
  '{{role}}': 'Volunteer',
  '{{date}}': 'April 15, 2026',
  '{{shift}}': 'Morning (8 AM – 12 PM)',
};
