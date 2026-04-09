import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, FileText, Globe, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import HospitalLogo from "@/components/HospitalLogo";
import { type Opportunity, type OpportunityStatus, typeColors, statusColors, deadlineLabel, daysUntil } from "@/components/dashboard/types";

interface OpportunityCardProps {
  opp: Opportunity;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onRemove: (id: string) => void;
  onLogHours: (opp: Opportunity) => void;
  onAddReflection: (opp: Opportunity) => void;
  onCardClick: (opp: Opportunity) => void;
}

export function OpportunityCard({
  opp,
  onStatusChange,
  onRemove,
  onLogHours,
  onAddReflection,
  onCardClick,
}: OpportunityCardProps) {
  const dl = deadlineLabel(opp.deadline);
  const dlDays = opp.deadline ? daysUntil(opp.deadline) : null;
  const dlUrgent = dlDays !== null && dlDays >= 0 && dlDays <= 3;

  return (
    <div
      className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/80 cursor-pointer"
      onClick={() => onCardClick(opp)}
    >
      {/* Top row: logo + name + 3-dot menu */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0 flex-1">
          <HospitalLogo
            logoUrl={opp.logo_url}
            hospitalName={opp.name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 break-words text-base font-medium text-foreground">
              {opp.name}
            </h3>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{opp.location}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {opp.website && (
              <DropdownMenuItem asChild>
                <a
                  href={opp.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" /> Visit Website
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onRemove(opp.id); }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pills row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            typeColors[opp.type] || "border-border text-muted-foreground"
          }`}
        >
          {opp.type === "emt" ? "EMT" : opp.type.charAt(0).toUpperCase() + opp.type.slice(1)}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[opp.status]}`}
        >
          {opp.status}
        </span>
        {dl && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              dlUrgent
                ? "bg-red-900/50 text-red-300"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {dl}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> {opp.hoursLogged}h logged
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> {opp.reflectionCount} reflections
        </span>
      </div>

      {/* Actions row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onLogHours(opp); }}
        >
          Log Hours
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onAddReflection(opp); }}
        >
          Add Reflection
        </Button>
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            value={opp.status}
            onValueChange={(val) =>
              onStatusChange(opp.id, val as OpportunityStatus)
            }
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Saved">Saved</SelectItem>
              <SelectItem value="Applied">Applied</SelectItem>
              <SelectItem value="Interviewing">Interviewing</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
