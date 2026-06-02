import { ArrowRight, CalendarClock, UserCircle, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { deadlineLabel } from "@/components/dashboard/types";

interface RailItem {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
  accent: string;
}

interface ThisWeekRailProps {
  nearestDeadline: { name: string; deadline: string } | null;
  profileIncomplete: boolean;
  savedCount: number;
  isGuest?: boolean;
}

export function ThisWeekRail({ nearestDeadline, profileIncomplete, savedCount, isGuest }: ThisWeekRailProps) {
  const items: RailItem[] = [];

  if (nearestDeadline) {
    const label = deadlineLabel(nearestDeadline.deadline);
    if (label) {
      items.push({
        icon: <CalendarClock className="h-4 w-4" />,
        label: nearestDeadline.name,
        sub: label,
        href: "/dashboard",
        accent: "border-amber-500/30 bg-amber-500/5 text-amber-300",
      });
    }
  }

  if (profileIncomplete) {
    items.push({
      icon: <UserCircle className="h-4 w-4" />,
      label: isGuest ? "Create your account" : "Complete your profile",
      sub: isGuest ? "Save your progress and track hours" : "Improves opportunity matching",
      href: isGuest ? "/auth" : "/profile",
      accent: "border-sky-500/30 bg-sky-500/5 text-sky-300",
    });
  }

  if (savedCount > 0) {
    items.push({
      icon: <Bookmark className="h-4 w-4" />,
      label: `${savedCount} saved ${savedCount === 1 ? "opportunity" : "opportunities"}`,
      sub: "Move one forward today",
      href: "/opportunities",
      accent: "border-primary/30 bg-primary/5 text-primary",
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">This Week</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.slice(0, 3).map((item, i) => (
          <Link
            key={i}
            to={item.href}
            className={cn(
              "flex-shrink-0 flex items-center gap-3 rounded-xl border px-4 py-3 min-w-[220px] hover:brightness-110 transition-all",
              item.accent
            )}
          >
            {item.icon}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-xs opacity-70">{item.sub}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-60" />
          </Link>
        ))}
      </div>
    </div>
  );
}
