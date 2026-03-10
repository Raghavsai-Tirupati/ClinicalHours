import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { PremiumGate } from "@/components/PremiumGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  Sparkles,
  Loader2,
  Target,
  TrendingUp,
  Shield,
  MapPin,
} from "lucide-react";

interface SchoolRecommendation {
  name: string;
  medianGPA: string;
  medianMCAT: string;
  tier: "reach" | "target" | "safety";
  rationale: string;
  tuition: string;
  location: string;
  inStateRate: string;
}

const MOCK_SCHOOLS: SchoolRecommendation[] = [
  { name: "Harvard Medical School", medianGPA: "3.93", medianMCAT: "521", tier: "reach", rationale: "Top research institution. Your MCAT is competitive but GPA slightly below median.", tuition: "$67,000", location: "Boston, MA", inStateRate: "N/A" },
  { name: "Johns Hopkins SOM", medianGPA: "3.92", medianMCAT: "521", tier: "reach", rationale: "World-class research. Strong fit for your research interests.", tuition: "$62,000", location: "Baltimore, MD", inStateRate: "N/A" },
  { name: "Washington University SOM", medianGPA: "3.91", medianMCAT: "521", tier: "reach", rationale: "Free tuition initiative. Highly competitive but worth applying.", tuition: "$0 (full scholarship)", location: "St. Louis, MO", inStateRate: "N/A" },
  { name: "Baylor College of Medicine", medianGPA: "3.88", medianMCAT: "519", tier: "target", rationale: "Texas Medical Center. Strong fit as a Texas resident with your stats.", tuition: "$34,000", location: "Houston, TX", inStateRate: "72%" },
  { name: "UT Southwestern", medianGPA: "3.85", medianMCAT: "518", tier: "target", rationale: "Excellent Texas school. Your stats are competitive. In-state advantage.", tuition: "$23,000 (IS)", location: "Dallas, TX", inStateRate: "89%" },
  { name: "Emory SOM", medianGPA: "3.83", medianMCAT: "517", tier: "target", rationale: "Great clinical training. Research-friendly environment.", tuition: "$57,000", location: "Atlanta, GA", inStateRate: "N/A" },
  { name: "University of Virginia SOM", medianGPA: "3.82", medianMCAT: "517", tier: "target", rationale: "Strong primary care track. Your community service is a good fit.", tuition: "$43,000 (OOS)", location: "Charlottesville, VA", inStateRate: "55%" },
  { name: "Wake Forest SOM", medianGPA: "3.80", medianMCAT: "516", tier: "target", rationale: "Innovative curriculum. Values diverse experiences.", tuition: "$61,000", location: "Winston-Salem, NC", inStateRate: "N/A" },
  { name: "Medical College of Georgia", medianGPA: "3.71", medianMCAT: "513", tier: "target", rationale: "Solid stats match. Service-oriented mission.", tuition: "$38,000 (OOS)", location: "Augusta, GA", inStateRate: "85%" },
  { name: "Texas Tech SOM", medianGPA: "3.75", medianMCAT: "511", tier: "safety", rationale: "Good Texas option. Your stats are above median. Rural health focus.", tuition: "$21,000 (IS)", location: "Lubbock, TX", inStateRate: "92%" },
  { name: "UT San Antonio (Long SOM)", medianGPA: "3.73", medianMCAT: "510", tier: "safety", rationale: "In-state advantage. Primary care mission aligns with your goals.", tuition: "$22,000 (IS)", location: "San Antonio, TX", inStateRate: "95%" },
  { name: "Texas A&M SOM", medianGPA: "3.70", medianMCAT: "509", tier: "safety", rationale: "Your alma mater connection is a strong asset. Stats above median.", tuition: "$20,000 (IS)", location: "Bryan, TX", inStateRate: "93%" },
];

const TIER_CONFIG = {
  reach: { label: "Reach", icon: TrendingUp, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  target: { label: "Target", icon: Target, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  safety: { label: "Safety", icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

const SchoolListContent = () => {
  const [gpa, setGPA] = useState("3.80");
  const [scienceGPA, setScienceGPA] = useState("3.75");
  const [mcat, setMCAT] = useState("515");
  const [state, setState] = useState("TX");
  const [researchFocus, setResearchFocus] = useState("balanced");
  const [doInterest, setDoInterest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SchoolRecommendation[] | null>(null);

  function handleGenerate() {
    setLoading(true);
    setTimeout(() => {
      setResults(MOCK_SCHOOLS);
      setLoading(false);
    }, 2500);
  }

  const reachSchools = results?.filter((s) => s.tier === "reach") || [];
  const targetSchools = results?.filter((s) => s.tier === "target") || [];
  const safetySchools = results?.filter((s) => s.tier === "safety") || [];

  return (
    <div>
      {!results && !loading && (
        <div className="rounded-lg border border-border bg-card p-6 max-w-2xl">
          <h3 className="text-sm font-medium text-foreground mb-4">Your Profile</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Overall GPA</Label>
                <Input type="number" step="0.01" min="0" max="4" className="mt-1.5" value={gpa} onChange={(e) => setGPA(e.target.value)} />
              </div>
              <div>
                <Label>Science GPA</Label>
                <Input type="number" step="0.01" min="0" max="4" className="mt-1.5" value={scienceGPA} onChange={(e) => setScienceGPA(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>MCAT Score</Label>
                <Input type="number" min="472" max="528" className="mt-1.5" value={mcat} onChange={(e) => setMCAT(e.target.value)} />
              </div>
              <div>
                <Label>State of Residency</Label>
                <Input className="mt-1.5" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g., TX" />
              </div>
            </div>
            <div>
              <Label>Orientation</Label>
              <Select value={researchFocus} onValueChange={setResearchFocus}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research-focused</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="primary_care">Primary care-focused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={doInterest} onCheckedChange={setDoInterest} />
              <Label>Include DO schools</Label>
            </div>
            <div className="pt-2">
              <Button onClick={handleGenerate} className="gap-1.5">
                <Sparkles className="h-4 w-4" /> Generate School List
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-20">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Building your school list...</p>
          <p className="text-sm text-muted-foreground mt-1">Analyzing stats, missions, and acceptance patterns</p>
        </div>
      )}

      {results && !loading && (
        <div className="space-y-8">
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            {(["reach", "target", "safety"] as const).map((tier) => {
              const config = TIER_CONFIG[tier];
              const schools = results.filter((s) => s.tier === tier);
              return (
                <div key={tier} className={`rounded-lg border ${config.border} ${config.bg} p-5`}>
                  <div className="flex items-center gap-2 mb-1">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{schools.length}</p>
                  <p className="text-xs text-muted-foreground">schools</p>
                </div>
              );
            })}
          </div>

          {/* School Lists */}
          {([
            { tier: "reach" as const, schools: reachSchools },
            { tier: "target" as const, schools: targetSchools },
            { tier: "safety" as const, schools: safetySchools },
          ]).map(({ tier, schools }) => {
            const config = TIER_CONFIG[tier];
            return (
              <div key={tier}>
                <h3 className={`text-sm font-medium mb-3 flex items-center gap-1.5 ${config.color}`}>
                  <config.icon className="h-4 w-4" /> {config.label} Schools ({schools.length})
                </h3>
                <div className="space-y-3">
                  {schools.map((school) => (
                    <div key={school.name} className={`rounded-lg border ${config.border} bg-card p-5`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{school.name}</h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{school.location}</span>
                            <span>GPA: {school.medianGPA}</span>
                            <span>MCAT: {school.medianMCAT}</span>
                            <span>{school.tuition}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{school.rationale}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <Button variant="outline" onClick={() => setResults(null)}>
            Regenerate List
          </Button>
        </div>
      )}
    </div>
  );
};

const SchoolListBuilder = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navigation />
    <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-heading">School List Builder</h1>
        <p className="text-muted-foreground mt-1">AI-powered reach/target/safety school list based on your profile.</p>
      </div>
      <PremiumGate featureName="School List Builder" description="Get a personalized school list with ClinicalHours Premium.">
        <SchoolListContent />
      </PremiumGate>
    </main>
    <Footer />
  </div>
);

export default SchoolListBuilder;
