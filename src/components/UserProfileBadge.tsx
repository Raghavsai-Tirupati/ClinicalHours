import { User, GraduationCap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileBadgeProps {
  fullName: string | null;
  university?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  clinicalHours?: number | null;
  className?: string;
  variant?: "compact" | "full";
}

export function UserProfileBadge({
  fullName,
  university,
  major,
  graduationYear,
  clinicalHours,
  className,
  variant = "compact",
}: UserProfileBadgeProps) {
  const hasDetails = university || major || graduationYear;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-sm font-medium">{fullName || "Anonymous"}</p>
          {hasDetails && (
            <p className="line-clamp-2 break-words text-xs text-muted-foreground">
              {[
                university,
                major,
                graduationYear ? `'${String(graduationYear).slice(-2)}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Full variant - for profile preview on Profile page
  return (
    <div className={cn("p-4 border rounded-lg bg-muted/30 space-y-2", className)}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{fullName || "Your Name"}</p>
          {hasDetails && (
            <p className="text-sm text-muted-foreground">
              {[
                university,
                major,
                graduationYear ? `Class of ${graduationYear}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
        </div>
      </div>
      
      {(clinicalHours !== null && clinicalHours !== undefined && clinicalHours > 0) && (
        <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {clinicalHours} clinical hours
          </span>
        </div>
      )}
    </div>
  );
}
