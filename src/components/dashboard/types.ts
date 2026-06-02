import type { ApplicationStatus, PositionType } from "@/types/positions";

export type OpportunityStatus = "Saved" | "Researching" | "Applied" | "Waiting" | "Interview" | "Accepted" | "Rejected" | "Archived";

export interface Opportunity {
  id: string;           // saved_opportunities.id — used for DB remove/update
  opportunityId: string; // opportunities.id — used for experience_entries lookup
  name: string;
  type: string;
  website: string;
  location: string;
  status: OpportunityStatus;
  deadline: string | null;
  hoursLogged: number;
  reflectionCount: number;
  logo_url: string | null;
  notes?: string | null;
  reminder_date?: string | null;
  last_contact_date?: string | null;
}

export interface Reflection {
  id: string;
  opportunityId: string;
  orgName: string;
  date: string;
  text: string;
}

export interface DashboardApplication {
  id: string;
  status: ApplicationStatus;
  submitted_at: string;
  position_title: string;
  position_type: PositionType;
  hospital_name: string;
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineLabel(deadline: string | null): string | null {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  if (days < 0) return "Past due";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export const statusColors: Record<OpportunityStatus, string> = {
  Saved: "bg-zinc-700/60 text-zinc-300",
  Researching: "bg-blue-900/50 text-blue-300",
  Applied: "bg-violet-900/50 text-violet-300",
  Waiting: "bg-amber-900/50 text-amber-300",
  Interview: "bg-yellow-900/50 text-yellow-300",
  Accepted: "bg-emerald-900/50 text-emerald-300",
  Rejected: "bg-red-900/50 text-red-300",
  Archived: "bg-zinc-900/40 text-zinc-500",
};

export const typeColors: Record<string, string> = {
  hospital: "border-red-500/40 text-red-300",
  clinic: "border-blue-500/40 text-blue-300",
  hospice: "border-purple-500/40 text-purple-300",
  emt: "border-orange-500/40 text-orange-300",
  volunteer: "border-teal-500/40 text-teal-300",
};
