import { ShieldCheck, Clock, Mail, CalendarClock, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/types";

type TrustChipsProps = {
  opportunity: Pick<
    Opportunity,
    "last_verified_at" | "verification_source" | "application_method" | "seasonality" | "link_status"
  >;
  className?: string;
};

const sourceLabel: Record<string, string> = {
  "clinic-confirmed":  "Clinic verified",
  "student-confirmed": "Student verified",
  "web-confirmed":     "Web verified",
  "unverified":        "Unverified",
};

const methodLabel: Record<string, string> = {
  portal: "Apply via portal",
  email:  "Apply via email",
  phone:  "Apply by phone",
  form:   "Apply via form",
};

const seasonLabel: Record<string, { text: string; cls: string }> = {
  "year-round":    { text: "Year-round",    cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  "summer-only":   { text: "Summer only",   cls: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
  "window-closed": { text: "Window closed", cls: "text-red-400 border-red-500/30 bg-red-500/10" },
};

export function TrustChips({ opportunity, className }: TrustChipsProps) {
  const chips: React.ReactNode[] = [];

  if (opportunity.verification_source && opportunity.verification_source !== "unverified") {
    chips.push(
      <span key="source" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
        <ShieldCheck className="h-3 w-3" />
        {sourceLabel[opportunity.verification_source]}
      </span>
    );
  }

  if (opportunity.last_verified_at) {
    const date = new Date(opportunity.last_verified_at);
    const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    chips.push(
      <span key="verified" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700">
        <Clock className="h-3 w-3" />
        Verified {label}
      </span>
    );
  }

  if (opportunity.application_method) {
    chips.push(
      <span key="method" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700">
        <Mail className="h-3 w-3" />
        {methodLabel[opportunity.application_method]}
      </span>
    );
  }

  if (opportunity.seasonality) {
    const s = seasonLabel[opportunity.seasonality];
    chips.push(
      <span key="season" className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", s.cls)}>
        <CalendarClock className="h-3 w-3" />
        {s.text}
      </span>
    );
  }

  if (opportunity.link_status === "retry-needed") {
    chips.push(
      <span key="link" className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/30">
        <LinkIcon className="h-3 w-3" />
        Link needs retry
      </span>
    );
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips}
    </div>
  );
}
