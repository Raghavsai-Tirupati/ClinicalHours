import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PremiumGate } from "@/components/PremiumGate";
import { Button } from "@/components/ui/button";
import { Target, BookOpen, AlertTriangle } from "lucide-react";
import { AAMC_COMPETENCIES, ALL_COMPETENCIES } from "@/lib/premium";
import { localSelect, TABLES } from "@/lib/localStore";

interface LocalReflection {
  id: string;
  activity_log_id: string;
  what_happened: string | null;
  what_stood_out: string | null;
  what_learned: string | null;
  competency_tags: string[];
  is_meaningful: boolean;
  created_at: string;
}

interface LocalActivityLog {
  id: string;
  activity_type: string;
  custom_organization_name: string | null;
  session_date: string;
}

function CompetencyCell({ name, count, onClick }: { name: string; count: number; onClick: () => void }) {
  const color =
    count >= 3 ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" :
    count >= 1 ? "bg-amber-500/15 border-amber-500/25 text-amber-300" :
    "bg-red-500/10 border-red-500/20 text-red-400";

  return (
    <button onClick={onClick} className={`rounded-lg border p-3 text-left transition-colors hover:opacity-80 ${color}`}>
      <p className="break-words text-xs font-medium">{name}</p>
      <p className="text-lg font-bold mt-0.5">{count}</p>
      <p className="text-[10px] opacity-70">reflection{count !== 1 ? "s" : ""}</p>
    </button>
  );
}

const CompetencyMapperContent = () => {
  const [reflections, setReflections] = useState<(LocalReflection & { activity_log: LocalActivityLog | null })[]>([]);
  const [selectedCompetency, setSelectedCompetency] = useState<string | null>(null);

  useEffect(() => {
    const allReflections = localSelect<LocalReflection>(TABLES.REFLECTIONS);
    const allLogs = localSelect<LocalActivityLog>(TABLES.ACTIVITY_LOGS);
    const logMap = new Map<string, LocalActivityLog>();
    allLogs.forEach((l) => logMap.set(l.id, l));

    setReflections(allReflections.map((r) => ({
      ...r,
      competency_tags: r.competency_tags || [],
      activity_log: logMap.get(r.activity_log_id) || null,
    })));
  }, []);

  const competencyCounts = useMemo(() => {
    const map = new Map<string, number>();
    ALL_COMPETENCIES.forEach((c) => map.set(c.name, 0));

    reflections.forEach((r) => {
      if (r.competency_tags && r.competency_tags.length > 0) {
        r.competency_tags.forEach((tag) => {
          map.set(tag, (map.get(tag) || 0) + 1);
        });
      } else {
        // Auto-tag: assign reflections to competencies based on content keywords
        const text = `${r.what_happened || ""} ${r.what_stood_out || ""} ${r.what_learned || ""}`.toLowerCase();
        if (text.length > 20) {
          // Simple keyword matching for demo purposes
          const autoTags: string[] = [];
          if (text.match(/empathy|compassion|caring|comforted|patient.*feel/)) autoTags.push("Empathy and Compassion");
          if (text.match(/team|collaborat|together|group|colleague/)) autoTags.push("Teamwork and Collaboration");
          if (text.match(/communicat|explain|listen|spoke|convers/)) autoTags.push("Oral Communication");
          if (text.match(/learn|grew|growth|improv|develop/)) autoTags.push("Commitment to Learning and Growth");
          if (text.match(/ethic|moral|right thing|dilemma|honest/)) autoTags.push("Ethical Responsibility to Self and Others");
          if (text.match(/resilien|adapt|challenge|overcame|difficult/)) autoTags.push("Resilience and Adaptability");
          if (text.match(/serv|help|volunteer|communit|give back/)) autoTags.push("Service Orientation");
          if (text.match(/reliab|depend|on time|responsib|trust/)) autoTags.push("Reliability and Dependability");
          if (text.match(/self.*aware|reflect|realiz.*about myself|understood.*myself/)) autoTags.push("Self-Awareness");
          if (text.match(/divers|cultur|understand.*other|perspectiv|different background/)) autoTags.push("Understanding Others");
          if (text.match(/interperson|relat|connect|rapport|bond/)) autoTags.push("Interpersonal Skills");
          if (text.match(/research|experiment|data|hypothesis|lab/)) autoTags.push("Scientific Inquiry");
          if (text.match(/critical|analyz|evaluat|reason|logic/)) autoTags.push("Critical Thinking");
          if (text.match(/writ|essay|document|report|record/)) autoTags.push("Written Communication");
          if (text.match(/behavio|psych|mental|emotion|motivat/)) autoTags.push("Human Behavior");
          if (text.match(/bio|anatomy|physio|cell|organ|body/)) autoTags.push("Living Systems");
          if (text.match(/statistic|quantit|number|calculat|measur/)) autoTags.push("Quantitative Reasoning");

          if (autoTags.length === 0) autoTags.push("Commitment to Learning and Growth");
          autoTags.forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1));
        }
      }
    });

    return map;
  }, [reflections]);

  const strongCount = ALL_COMPETENCIES.filter((c) => (competencyCounts.get(c.name) || 0) >= 3).length;
  const gapCount = ALL_COMPETENCIES.filter((c) => (competencyCounts.get(c.name) || 0) === 0).length;

  const filteredReflections = selectedCompetency
    ? reflections.filter((r) => {
        if (r.competency_tags?.includes(selectedCompetency)) return true;
        // Also match auto-tagged ones
        const text = `${r.what_happened || ""} ${r.what_stood_out || ""} ${r.what_learned || ""}`.toLowerCase();
        const comp = selectedCompetency.toLowerCase();
        return text.includes(comp.split(" ")[0]);
      })
    : [];

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3"><Target className="h-5 w-5 text-primary" /><div><p className="text-2xl font-semibold text-foreground">{reflections.length}</p><p className="text-xs text-muted-foreground">Total Reflections</p></div></div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-emerald-400" /><div><p className="text-2xl font-semibold text-foreground">{strongCount} / 17</p><p className="text-xs text-muted-foreground">Strong Competencies (3+)</p></div></div>
        </div>
        <div className={`rounded-lg border p-5 ${gapCount > 0 ? "border-red-500/20 bg-red-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-3"><AlertTriangle className={`h-5 w-5 ${gapCount > 0 ? "text-red-400" : "text-muted-foreground"}`} /><div><p className="text-2xl font-semibold text-foreground">{gapCount}</p><p className="text-xs text-muted-foreground">Competency Gaps (0 reflections)</p></div></div>
        </div>
      </div>

      {reflections.length === 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5 mb-8">
          <p className="text-sm text-amber-300">No reflections yet. Log hours and write reflections in the <Link to="/hours" className="underline">Hour Tracker</Link> to see your competency coverage here.</p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500/30" /> 3+ reflections</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500/25" /> 1-2 reflections</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500/20" /> 0 reflections (gap)</span>
      </div>

      <div className="space-y-8">
        {[
          { title: "Professional Competencies", items: AAMC_COMPETENCIES.professional },
          { title: "Science Competencies", items: AAMC_COMPETENCIES.science },
          { title: "Thinking & Reasoning Competencies", items: AAMC_COMPETENCIES.thinking },
        ].map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{group.title}</h3>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.items.map((comp) => (
                <CompetencyCell
                  key={comp.id}
                  name={comp.name}
                  count={competencyCounts.get(comp.name) || 0}
                  onClick={() => setSelectedCompetency(selectedCompetency === comp.name ? null : comp.name)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedCompetency && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">{selectedCompetency}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCompetency(null)}>Close</Button>
          </div>
          {filteredReflections.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">No reflections tagged with this competency yet.</p>
              <p className="text-xs text-muted-foreground">Consider activities that demonstrate {selectedCompetency.toLowerCase()}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReflections.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="font-medium text-foreground/80">{r.activity_log?.custom_organization_name || "Activity"}</span>
                    {r.activity_log?.session_date && (
                      <>
                        <span>&middot;</span>
                        <span>{new Date(r.activity_log.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </>
                    )}
                  </div>
                  {r.what_learned && <p className="text-sm text-foreground">{r.what_learned}</p>}
                  {!r.what_learned && r.what_happened && <p className="text-sm text-foreground">{r.what_happened}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CompetencyMapper = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-24 md:pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">AAMC Competency Tracker</h1>
        <p className="text-muted-foreground mt-1">Visualize your coverage across all 17 AAMC premed competencies.</p>
      </div>
      <PremiumGate featureName="AAMC Competency Tracker" description="See your competency coverage and gap analysis with ClinicalHours Premium.">
        <CompetencyMapperContent />
      </PremiumGate>
    </main>
    <Footer />
  </div>
);

export default CompetencyMapper;
