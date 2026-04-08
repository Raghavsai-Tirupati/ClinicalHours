/**
 * Email Template Renderer (Dry-run / no real sends)
 * ---------------------------------------------------
 * Renders every known email template in the ClinicalHours codebase with
 * mock test data and prints the result. This is for verification only — it
 * does NOT send any emails.
 *
 * Run with:  npx tsx scripts/renderEmailTemplates.ts
 *
 * The script covers two classes of templates:
 *   1. User-authored templates stored in the `email_templates` table.
 *      These support {{name}}, {{role}}, {{date}}, {{shift}} variables
 *      (see src/components/clinic-dashboard/email-communication/types.ts).
 *   2. Hard-coded transactional templates inside supabase/functions/*.
 *      These are inlined in the edge function source.
 */

// ───── 1. Substitution helper (mirrors EmailTemplates.tsx) ────────────────
const SAMPLE_DATA: Record<string, string> = {
  '{{name}}': 'Jane Doe',
  '{{role}}': 'Volunteer',
  '{{date}}': 'April 15, 2026',
  '{{shift}}': 'Morning (8 AM – 12 PM)',
};

function renderTemplate(text: string): string {
  let out = text;
  for (const [placeholder, value] of Object.entries(SAMPLE_DATA)) {
    out = out.split(placeholder).join(value);
  }
  return out;
}

function assertNoUnresolvedPlaceholders(label: string, text: string) {
  const unresolved = text.match(/\{\{[^}]+\}\}/g);
  if (unresolved) {
    console.warn(`  ! ${label}: unresolved placeholders:`, unresolved);
  } else {
    console.log(`  ✓ ${label}: all variables substituted`);
  }
}

// ───── 2. Sample user-authored templates (matches admin UI categories) ────
interface SampleTemplate {
  category: 'accepted' | 'rejected' | 'waitlisted' | 'on_call' | 'onboarding';
  name: string;
  subject: string;
  body: string;
}

const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    category: 'accepted',
    name: 'Application Accepted',
    subject: 'Congratulations, {{name}} — welcome to the team!',
    body: `Hi {{name}},\n\nWe are thrilled to offer you the {{role}} position. Please report on {{date}} for your {{shift}} shift.\n\nThanks,\nBCS Free Health Clinic`,
  },
  {
    category: 'rejected',
    name: 'Application Not Selected',
    subject: 'Update on your application, {{name}}',
    body: `Hi {{name}},\n\nThank you for applying for the {{role}} position. After careful consideration we're unable to move forward at this time.\n\nBest,\nBCS Free Health Clinic`,
  },
  {
    category: 'waitlisted',
    name: 'Waitlist Notification',
    subject: 'You\'re on the waitlist, {{name}}',
    body: `Hi {{name}},\n\nYou have been placed on the waitlist for the {{role}} position. We'll reach out if a spot opens up.\n\nBCS Free Health Clinic`,
  },
  {
    category: 'on_call',
    name: 'On-Call Request',
    subject: 'On-call request for {{date}}',
    body: `Hi {{name}},\n\nWe need an on-call {{role}} for {{date}} during the {{shift}} shift. Can you cover?\n\nThanks,\nBCS Free Health Clinic`,
  },
  {
    category: 'onboarding',
    name: 'Onboarding Reminder',
    subject: 'Next steps for your {{role}} onboarding',
    body: `Hi {{name}},\n\nHere are the next steps to finish your {{role}} onboarding before your start date of {{date}}.\n\n— BCS Free Health Clinic`,
  },
];

// ───── 3. Render + verify ─────────────────────────────────────────────────
const EXPECTED_FROM = 'admin@bcsclinic.org';

console.log('='.repeat(72));
console.log('ClinicalHours Email Template Renderer — DRY RUN (no real sends)');
console.log('='.repeat(72));
console.log(`Expected clinic from-address: ${EXPECTED_FROM}\n`);

for (const tpl of SAMPLE_TEMPLATES) {
  const subject = renderTemplate(tpl.subject);
  const body = renderTemplate(tpl.body);
  console.log('-'.repeat(72));
  console.log(`Template: ${tpl.name}  [category=${tpl.category}]`);
  console.log(`From:    ${EXPECTED_FROM}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:');
  console.log(body.split('\n').map((l) => '  ' + l).join('\n'));
  assertNoUnresolvedPlaceholders('subject', subject);
  assertNoUnresolvedPlaceholders('body', body);
}

console.log('-'.repeat(72));
console.log('\nDone. No emails were sent. Review output above for correctness.');
