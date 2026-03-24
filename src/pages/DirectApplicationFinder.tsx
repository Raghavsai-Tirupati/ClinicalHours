import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PremiumGate } from "@/components/PremiumGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ExternalLink, CheckCircle, AlertCircle, HelpCircle, Loader2, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ApplicationLinkResult {
  url: string;
  confidence: "high" | "medium" | "low";
  label: string;
  note?: string;
}

interface FinderResult {
  organizationName: string;
  links: ApplicationLinkResult[];
  searchedAt: string;
}

function ConfidenceBadge({ confidence }: { confidence: ApplicationLinkResult["confidence"] }) {
  if (confidence === "high") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
        <CheckCircle className="h-3 w-3" /> High confidence
      </span>
    );
  }
  if (confidence === "medium") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
        <AlertCircle className="h-3 w-3" /> Medium confidence
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <HelpCircle className="h-3 w-3" /> Low confidence
    </span>
  );
}

const DirectApplicationFinderContent = () => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FinderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setRateLimited(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("find-application-link", {
        body: { organizationName: trimmed },
      });

      if (fnError) {
        if (fnError.message?.includes("429") || fnError.message?.toLowerCase().includes("rate")) {
          setRateLimited(true);
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      setResult(data as FinderResult);
    } catch {
      setError("Could not reach the search service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch} className="mb-8">
        <Label className="text-sm text-muted-foreground mb-2 block">
          Enter a hospital, clinic, or research institution name
        </Label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Houston Methodist Hospital, Mayo Clinic..."
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !query.trim()} className="gap-2 shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Find Links
          </Button>
        </div>
      </form>

      {rateLimited && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          You've reached the search limit. Please wait a few minutes before trying again.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">
            Results for <span className="text-primary">{result.organizationName}</span>
          </h2>

          {result.links.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <LinkIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No direct application links found.</p>
              <p className="text-muted-foreground text-xs mt-1">Try searching for a more specific name or check the hospital's website directly.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.links.map((link, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{link.label}</span>
                        <ConfidenceBadge confidence={link.confidence} />
                      </div>
                      <p className="break-all text-xs text-muted-foreground">{link.url}</p>
                      {link.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{link.note}</p>
                      )}
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5">
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Links are found via web search and may not always be current. Always verify directly with the institution.
          </p>
        </div>
      )}

      {!result && !isLoading && !error && !rateLimited && (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-1">Search for any clinical site to find their volunteer or shadowing application page.</p>
          <p className="text-xs text-muted-foreground">Saves you hours of hunting through hospital websites.</p>
        </div>
      )}
    </div>
  );
};

const DirectApplicationFinder = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">Direct Application Finder</h1>
        <p className="text-muted-foreground mt-1">
          Find direct volunteer and shadowing application links for any hospital or clinic — skip the Google maze.
        </p>
      </div>
      <PremiumGate featureName="Direct Application Finder" description="Find direct application links for any clinical site with ClinicalHours Premium.">
        <DirectApplicationFinderContent />
      </PremiumGate>
    </main>
    <Footer />
  </div>
);

export default DirectApplicationFinder;
