import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, Lock, Loader2, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface LinkResult {
  url: string;
  confidence: "high" | "medium" | "low";
  label: string;
  note?: string;
}

// Module-level cache — persists across renders and component remounts
const cache = new Map<string, { links: LinkResult[]; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(id: string): LinkResult[] | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.links;
}

function ConfidenceIcon({ confidence }: { confidence: LinkResult["confidence"] }) {
  if (confidence === "high") return <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />;
  if (confidence === "medium") return <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />;
  return <HelpCircle className="h-3 w-3 text-muted-foreground/60 shrink-0" />;
}

type Status = "idle" | "loading" | "done" | "error" | "empty";

export function FindApplicationButton({
  opportunityId,
  opportunityName,
  websiteHint,
  isPremium,
  compact = false,
}: {
  opportunityId: string;
  opportunityName: string;
  websiteHint?: string | null;
  isPremium: boolean;
  /** Compact dark variant for the map popup */
  compact?: boolean;
}) {
  const [status, setStatus] = useState<Status>(() =>
    getCached(opportunityId) !== null ? "done" : "idle"
  );
  const [links, setLinks] = useState<LinkResult[]>(() => getCached(opportunityId) ?? []);

  // ── Non-premium ──────────────────────────────────────────────────────────────
  if (!isPremium) {
    if (compact) {
      return (
        <Link
          to="/premium/purchase"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-medium rounded-xl bg-amber-500/10 text-amber-400/50 border border-amber-500/15 hover:bg-amber-500/15 transition-all"
        >
          <Lock className="w-3 h-3" />
          Find App Link
        </Link>
      );
    }
    return (
      <Button variant="outline" size="sm" asChild className="gap-1.5 opacity-50 cursor-default">
        <Link to="/premium/purchase">
          <Lock className="h-3.5 w-3.5" />
          Find Application
        </Link>
      </Button>
    );
  }

  // ── Search handler ────────────────────────────────────────────────────────────
  const handleSearch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("find-application-link", {
        body: {
          organizationName: opportunityName,
          ...(websiteHint ? { websiteHint } : {}),
        },
      });
      if (error) throw error;
      const result = data as { links: LinkResult[] };
      cache.set(opportunityId, { links: result.links, timestamp: Date.now() });
      setLinks(result.links);
      setStatus(result.links.length > 0 ? "done" : "empty");
    } catch {
      setStatus("error");
    }
  };

  // ── States: compact (map popup) variant ──────────────────────────────────────
  if (compact) {
    if (status === "idle") {
      return (
        <button
          onClick={handleSearch}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-medium rounded-xl bg-violet-500/15 text-violet-300 border border-violet-500/25 hover:bg-violet-500/25 transition-all active:scale-[0.98]"
        >
          <Search className="w-3 h-3" />
          Find App Link
        </button>
      );
    }
    if (status === "loading") {
      return (
        <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] text-white/35 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <Loader2 className="w-3 h-3 animate-spin" />
          Searching…
        </div>
      );
    }
    if (status === "error") {
      return (
        <button
          onClick={handleSearch}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] text-red-400/70 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all"
        >
          Try again
        </button>
      );
    }
    if (status === "empty") {
      return (
        <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] text-white/20 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          No link found
        </div>
      );
    }
    // done
    const top = links[0];
    return (
      <a
        href={top.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-medium rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all active:scale-[0.98] min-w-0"
        title={top.label}
      >
        <ConfidenceIcon confidence={top.confidence} />
        <span className="truncate">Apply</span>
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }

  // ── States: standard (card / detail page) variant ────────────────────────────
  if (status === "idle") {
    return (
      <Button variant="outline" size="sm" onClick={handleSearch} className="gap-1.5">
        <Search className="h-3.5 w-3.5" />
        Find Application →
      </Button>
    );
  }
  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Searching…
      </Button>
    );
  }
  if (status === "error") {
    return (
      <Button variant="outline" size="sm" onClick={handleSearch} className="gap-1.5 text-destructive border-destructive/40">
        Try again
      </Button>
    );
  }
  if (status === "empty") {
    return (
      <span className="text-xs text-muted-foreground px-1">No direct link found</span>
    );
  }
  // done
  const top = links[0];
  return (
    <a
      href={top.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted/60 transition-colors max-w-xs"
      title={top.label}
    >
      <ConfidenceIcon confidence={top.confidence} />
      <span className="truncate">{top.label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  );
}
