import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PremiumGate } from "@/components/PremiumGate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  PenTool,
  Sparkles,
  Loader2,
  Tag,
  BookOpen,
  FileText,
  Lightbulb,
} from "lucide-react";
import { SECONDARY_ARCHETYPES } from "@/lib/premium";

interface StoryFragment {
  id: string;
  text: string;
  source: string;
  date: string;
  relevance: "high" | "medium";
}

interface ClassificationResult {
  archetypes: typeof SECONDARY_ARCHETYPES[number][];
  fragments: StoryFragment[];
  outline: string[];
}

const MOCK_FRAGMENTS: StoryFragment[] = [
  { id: "1", text: "I observed a physician spending extra time explaining a diagnosis to an elderly patient who was visibly anxious. The patience and empathy in that interaction showed me what it means to treat the whole person.", source: "Shadowing at Houston Methodist", date: "Jan 15, 2026", relevance: "high" },
  { id: "2", text: "Working with a diverse team of nurses, PAs, and physicians during a busy ER shift taught me the importance of clear communication and mutual respect across different roles.", source: "Volunteering at Ben Taub", date: "Feb 3, 2026", relevance: "high" },
  { id: "3", text: "The moment a patient thanked me for simply listening to their story reminded me that healing begins with connection, not just treatment.", source: "Volunteering at MD Anderson", date: "Mar 12, 2026", relevance: "medium" },
];

const SecondaryEngineContent = () => {
  const [prompt, setPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ClassificationResult | null>(null);

  function handleAnalyze() {
    if (!prompt.trim()) return;
    setAnalyzing(true);

    setTimeout(() => {
      const matchedArchetypes = SECONDARY_ARCHETYPES.filter((a) =>
        ["service", "clinical", "diversity"].includes(a.id)
      ).slice(0, 2);

      setResult({
        archetypes: matchedArchetypes,
        fragments: MOCK_FRAGMENTS,
        outline: [
          "Open with a specific clinical encounter that demonstrated your commitment to service",
          "Connect the experience to the prompt's focus on meaningful impact",
          "Describe what you learned about yourself and your approach to patient care",
          "Close with how this shapes your vision for your medical career",
        ],
      });
      setAnalyzing(false);
    }, 2000);
  }

  return (
    <div>
      {/* Prompt Input */}
      <div className="rounded-lg border border-border bg-card p-6 mb-8">
        <Label className="mb-2 block text-foreground">Paste a secondary essay prompt</Label>
        <Textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g., "Describe a meaningful clinical experience and what it taught you about patient care."'
          className="mb-4"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            We'll classify the prompt and surface relevant story fragments from your reflections.
          </p>
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || !prompt.trim()}
            className="gap-1.5"
          >
            {analyzing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Analyze Prompt</>
            )}
          </Button>
        </div>
      </div>

      {/* Archetype Buttons (browse mode) */}
      {!result && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Or browse by archetype</h3>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {SECONDARY_ARCHETYPES.map((a) => (
              <button
                key={a.id}
                onClick={() => setPrompt(a.prompt)}
                className="rounded-lg border border-border bg-card p-3 text-left hover:border-border/80 transition-colors"
              >
                <p className="text-xs font-medium text-foreground">{a.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* Classification */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <Tag className="h-4 w-4" /> Prompt Classification
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.archetypes.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 text-sm text-violet-300"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  {a.name}
                </span>
              ))}
            </div>
          </section>

          {/* Story Fragments */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Story Fragments from Your Reflections
            </h3>
            <div className="space-y-3">
              {result.fragments.map((f) => (
                <div
                  key={f.id}
                  className={`rounded-lg border p-4 ${
                    f.relevance === "high"
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="font-medium text-foreground/80">{f.source}</span>
                    <span>&middot;</span>
                    <span>{f.date}</span>
                    {f.relevance === "high" && (
                      <span className="text-emerald-400 font-medium">High relevance</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground italic">"{f.text}"</p>
                </div>
              ))}
            </div>
          </section>

          {/* Outline */}
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Suggested Outline
            </h3>
            <div className="rounded-lg border border-border bg-card p-5">
              <ol className="space-y-3">
                {result.outline.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground pt-0.5">{item}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setResult(null); setPrompt(""); }}>
              New Prompt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const SecondaryEngine = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-24 md:pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">Secondary Essay Coach</h1>
        <p className="text-muted-foreground mt-1">Classify prompts into archetypes and surface relevant stories from your reflections.</p>
      </div>
      <PremiumGate featureName="Secondary Essay Coach" description="Reuse your best stories across secondary applications with ClinicalHours Premium.">
        <SecondaryEngineContent />
      </PremiumGate>
    </main>
    <Footer />
  </div>
);

export default SecondaryEngine;
