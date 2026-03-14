import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  MapPin,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Loader2,
  Star,
  Clock,
  Navigation as NavIcon,
} from "lucide-react";
import { PRE_HEALTH_TRACKS, SPECIALTIES, YEARS_IN_SCHOOL } from "@/lib/premium";
import { Link } from "react-router-dom";

type Step = "profile" | "interests" | "logistics" | "results";

interface QuizData {
  preHealthTrack: string;
  year: string;
  major: string;
  opportunityTypes: string[];
  specialties: string[];
  patientInteraction: string;
  zipCode: string;
  maxDistance: string;
  availableDays: string[];
  availableTimes: string[];
  transportation: string;
}

interface MatchResult {
  id: string;
  name: string;
  location: string;
  matchScore: number;
  rationale: string;
  distance: string;
  type: string;
}

function MultiSelect({ options, selected, onChange, columns = 2 }: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  columns?: number;
}) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() =>
              onChange(
                isSelected
                  ? selected.filter((s) => s !== opt)
                  : [...selected, opt]
              )
            }
            className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border/80"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
              i <= current
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span className={`hidden sm:block text-xs ${i <= current ? "text-foreground" : "text-muted-foreground"}`}>
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const MOCK_RESULTS: MatchResult[] = [
  { id: "1", name: "Houston Methodist Hospital", location: "Houston, TX", matchScore: 94, rationale: "Strong fit — cardiology department, 8 min from campus, accepts Tuesday volunteers", distance: "3.2 mi", type: "Shadowing" },
  { id: "2", name: "MD Anderson Cancer Center", location: "Houston, TX", matchScore: 89, rationale: "Excellent research opportunities in oncology, flexible scheduling, public transit accessible", distance: "5.1 mi", type: "Research" },
  { id: "3", name: "Texas Children's Hospital", location: "Houston, TX", matchScore: 85, rationale: "Top pediatrics program, volunteer program with direct patient interaction", distance: "4.7 mi", type: "Volunteering" },
  { id: "4", name: "Ben Taub General Hospital", location: "Houston, TX", matchScore: 82, rationale: "Level 1 trauma center, emergency medicine exposure, great for pre-med shadowing", distance: "6.3 mi", type: "Shadowing" },
  { id: "5", name: "Memorial Hermann TMC", location: "Houston, TX", matchScore: 78, rationale: "Large system with multiple specialty options, near campus, flexible hours", distance: "2.8 mi", type: "Clinical Employment" },
  { id: "6", name: "St. Luke's Health", location: "Houston, TX", matchScore: 75, rationale: "Strong internal medicine program, accepts weekday afternoon volunteers", distance: "7.1 mi", type: "Volunteering" },
  { id: "7", name: "VA Medical Center", location: "Houston, TX", matchScore: 72, rationale: "Unique patient population, psychiatry rotations available, research-friendly", distance: "8.4 mi", type: "Research" },
];

const OpportunityQuiz = () => {
  const { user } = useAuth();
  const { isPremium } = usePremiumStatus();
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quiz, setQuiz] = useState<QuizData>({
    preHealthTrack: "",
    year: "",
    major: "",
    opportunityTypes: [],
    specialties: [],
    patientInteraction: "",
    zipCode: "",
    maxDistance: "25",
    availableDays: [],
    availableTimes: [],
    transportation: "",
  });

  const steps: Step[] = ["profile", "interests", "logistics", "results"];
  const stepLabels = ["Profile", "Interests", "Logistics", "Results"];

  const handleSubmit = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowResults(true);
      setStepIndex(3);
    }, 2500);
  };

  const currentStep = steps[stepIndex];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400 mb-4">
            <Brain className="h-4 w-4" />
            PathFinder — AI Opportunity Matcher
          </div>
          <h1 className="text-2xl font-bold text-foreground font-heading">
            PathFinder — Find Your Perfect Match
          </h1>
          <p className="text-muted-foreground mt-1">
            Answer a few questions and we'll match you with the best opportunities from our database.
          </p>
        </div>

        <StepIndicator current={stepIndex} steps={stepLabels} />

        {isLoading && (
          <div className="text-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-violet-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Analyzing opportunities...</p>
            <p className="text-sm text-muted-foreground mt-1">Finding your best matches</p>
          </div>
        )}

        {!isLoading && !showResults && currentStep === "profile" && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div>
              <Label>Pre-health track</Label>
              <Select value={quiz.preHealthTrack} onValueChange={(v) => setQuiz({ ...quiz, preHealthTrack: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select your track" /></SelectTrigger>
                <SelectContent>
                  {PRE_HEALTH_TRACKS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year in school</Label>
              <Select value={quiz.year} onValueChange={(v) => setQuiz({ ...quiz, year: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select your year" /></SelectTrigger>
                <SelectContent>
                  {YEARS_IN_SCHOOL.map((y) => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Major</Label>
              <Input
                className="mt-1.5"
                placeholder="e.g., Biology, Biomedical Engineering"
                value={quiz.major}
                onChange={(e) => setQuiz({ ...quiz, major: e.target.value })}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStepIndex(1)} className="gap-1.5">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !showResults && currentStep === "interests" && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div>
              <Label className="mb-2 block">Opportunity types (select all that apply)</Label>
              <MultiSelect
                options={["Shadowing", "Volunteering", "Research", "Clinical Employment"]}
                selected={quiz.opportunityTypes}
                onChange={(v) => setQuiz({ ...quiz, opportunityTypes: v })}
              />
            </div>
            <div>
              <Label className="mb-2 block">Specialty interests</Label>
              <MultiSelect
                options={[...SPECIALTIES]}
                selected={quiz.specialties}
                onChange={(v) => setQuiz({ ...quiz, specialties: v })}
                columns={3}
              />
            </div>
            <div>
              <Label>Patient interaction preference</Label>
              <Select value={quiz.patientInteraction} onValueChange={(v) => setQuiz({ ...quiz, patientInteraction: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select preference" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct patient contact</SelectItem>
                  <SelectItem value="observation">Observation only</SelectItem>
                  <SelectItem value="either">Either</SelectItem>
                  <SelectItem value="no_preference">No preference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStepIndex(0)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStepIndex(2)} className="gap-1.5">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !showResults && currentStep === "logistics" && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Zip code or campus</Label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g., 77030"
                  value={quiz.zipCode}
                  onChange={(e) => setQuiz({ ...quiz, zipCode: e.target.value })}
                />
              </div>
              <div>
                <Label>Max travel distance</Label>
                <Select value={quiz.maxDistance} onValueChange={(v) => setQuiz({ ...quiz, maxDistance: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 miles</SelectItem>
                    <SelectItem value="10">10 miles</SelectItem>
                    <SelectItem value="25">25 miles</SelectItem>
                    <SelectItem value="50">50 miles</SelectItem>
                    <SelectItem value="100">50+ miles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Available days</Label>
              <MultiSelect
                options={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}
                selected={quiz.availableDays}
                onChange={(v) => setQuiz({ ...quiz, availableDays: v })}
                columns={4}
              />
            </div>
            <div>
              <Label className="mb-2 block">Available times</Label>
              <MultiSelect
                options={["Morning", "Afternoon", "Evening", "Flexible"]}
                selected={quiz.availableTimes}
                onChange={(v) => setQuiz({ ...quiz, availableTimes: v })}
                columns={4}
              />
            </div>
            <div>
              <Label>Transportation</Label>
              <Select value={quiz.transportation} onValueChange={(v) => setQuiz({ ...quiz, transportation: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="How do you get around?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="car">Has car</SelectItem>
                  <SelectItem value="public_transit">Public transit only</SelectItem>
                  <SelectItem value="bike_walk">Bike / walk only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStepIndex(1)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSubmit} className="gap-1.5">
                <Sparkles className="h-4 w-4" /> Find My Matches
              </Button>
            </div>
          </div>
        )}

        {!isLoading && showResults && (
          <div>
            <div className="text-center mb-6">
              <p className="text-sm text-emerald-400 font-medium">
                We found {MOCK_RESULTS.length} matches for you
              </p>
            </div>

            <div className="space-y-3">
              {MOCK_RESULTS.map((result, i) => {
                const isLocked = !isPremium && i >= 3;
                return (
                  <div
                    key={result.id}
                    className={`rounded-lg border border-border bg-card p-5 ${isLocked ? "opacity-50 blur-[2px] select-none" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{result.name}</span>
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {result.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{result.location}</span>
                          <span className="flex items-center gap-1"><NavIcon className="h-3 w-3" />{result.distance}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{result.rationale}</p>
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                          <span className="text-sm font-bold text-emerald-400">{result.matchScore}%</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">match</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isPremium && (
              <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-center">
                <Lock className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Unlock all {MOCK_RESULTS.length} matches
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Premium members see all results, save matches, and get detailed breakdowns.
                </p>
                <Button className="gap-2" asChild>
                  <Link to="/premium">
                    <Sparkles className="h-4 w-4" /> Upgrade to Premium
                  </Link>
                </Button>
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => { setShowResults(false); setStepIndex(0); }}>
                Retake Quiz
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OpportunityQuiz;
