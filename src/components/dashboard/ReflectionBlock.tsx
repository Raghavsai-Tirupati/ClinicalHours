import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Quote, Trash2 } from "lucide-react";
import type { Reflection } from "@/components/dashboard/types";

interface ReflectionBlockProps {
  reflection: Reflection;
  onDelete: (id: string) => void;
}

export function ReflectionBlock({ reflection, onDelete }: ReflectionBlockProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="group rounded-lg border border-border bg-card p-5 relative">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Quote className="h-3.5 w-3.5 text-primary/60" />
        <span className="font-medium text-foreground/80">
          {reflection.orgName}
        </span>
        <span>&middot;</span>
        <time>
          {new Date(reflection.date.includes("T") ? reflection.date : reflection.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        <div className="ml-auto">
          {confirming ? (
            <div className="flex items-center gap-1">
              <Button variant="destructive" size="sm" className="h-6 px-2 text-xs" onClick={() => onDelete(reflection.id)}>
                Delete
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {reflection.text}
      </p>
    </div>
  );
}
