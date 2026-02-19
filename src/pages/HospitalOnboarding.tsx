import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Search,
  Plus,
  ChevronRight,
  Loader2,
  MapPin,
  Globe,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Hospital {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
}

type Step = "search" | "create" | "confirm";

export default function HospitalOnboarding() {
  const { user, isReady, isGuest } = useAuth();
  const navigate = useNavigate();
  const { member, loading: memberLoading, refresh } = useHospitalMember();

  // Search state
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<Hospital[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Hospital | null>(null);
  const [step, setStep] = useState<Step>("search");

  // Create hospital form fields
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Auth guards
  useEffect(() => {
    if (!isReady) return;
    if (!user || isGuest) {
      navigate("/auth");
    }
  }, [isReady, user, isGuest, navigate]);

  // Redirect to admin if already a member
  useEffect(() => {
    if (!memberLoading && member) {
      navigate("/hospital/admin");
    }
  }, [memberLoading, member, navigate]);

  // Search hospitals as user types
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    supabase
      .from("hospitals")
      .select("id, name, city, state, address, website")
      .ilike("name", `%${debouncedQuery}%`)
      .limit(8)
      .then(({ data }) => {
        setResults((data as Hospital[]) || []);
        setSearching(false);
      });
  }, [debouncedQuery]);

  function handleSelectHospital(h: Hospital) {
    setSelected(h);
    setStep("confirm");
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      let hospitalId: string;

      if (step === "create") {
        if (!newName.trim()) {
          setError("Hospital name is required.");
          setSubmitting(false);
          return;
        }
        const { data: newHosp, error: hospErr } = await supabase
          .from("hospitals")
          .insert({
            name: newName.trim(),
            address: newAddress.trim() || null,
            city: newCity.trim() || null,
            state: newState.trim() || null,
            website: newWebsite.trim() || null,
          })
          .select("id")
          .single();

        if (hospErr || !newHosp) {
          throw new Error(hospErr?.message || "Failed to create hospital.");
        }
        hospitalId = newHosp.id;
      } else {
        hospitalId = selected!.id;
      }

      // Create hospital_accounts row (may already exist)
      const { data: account, error: accErr } = await supabase
        .from("hospital_accounts")
        .insert({ hospital_id: hospitalId })
        .select("id")
        .single();

      let accountId: string;

      if (accErr) {
        // Unique constraint: hospital already has an account
        if (accErr.code === "23505" || accErr.message.includes("unique")) {
          const { data: existing, error: findErr } = await supabase
            .from("hospital_accounts")
            .select("id")
            .eq("hospital_id", hospitalId)
            .single();

          if (findErr || !existing) {
            throw new Error(
              "This hospital already has an account. Contact the current owner to be added."
            );
          }
          accountId = existing.id;
        } else {
          throw new Error(accErr.message);
        }
      } else {
        accountId = account.id;
      }

      // Create hospital_members row with owner role
      const { error: memErr } = await supabase.from("hospital_members").insert({
        account_id: accountId,
        user_id: user.id,
        role: "owner",
      });

      if (memErr && !memErr.message.includes("unique")) {
        throw new Error(memErr.message);
      }

      setDone(true);
      refresh();
      setTimeout(() => navigate("/hospital/admin"), 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Loading states
  if (!isReady || memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Hospital Account Created!
          </h2>
          <p className="text-muted-foreground">
            Redirecting to your admin dashboard…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Building2 className="h-4 w-4" />
              <span>Hospital Onboarding</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Set up your hospital account
            </h1>
            <p className="text-muted-foreground">
              Search for your hospital to get started. If it's not listed, you
              can add it.
            </p>
          </div>

          {/* ── Step: Search ─────────────────────────────────────────────── */}
          {step === "search" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-muted/30 border-b border-border px-6 py-4">
                <h2 className="font-semibold text-foreground">
                  Find your hospital
                </h2>
              </div>
              <div className="p-6">
                {/* Search input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type hospital name…"
                    className="pl-9"
                    autoFocus
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Search results */}
                {results.length > 0 && (
                  <div className="space-y-1 mb-4">
                    {results.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => handleSelectHospital(h)}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-muted/40 transition-colors group flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {h.name}
                          </p>
                          {(h.city || h.state) && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span>
                                {[h.city, h.state].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}

                {query && !searching && results.length === 0 && (
                  <p className="text-sm text-muted-foreground mb-4 text-center py-2">
                    No hospitals found for &ldquo;{query}&rdquo;
                  </p>
                )}

                {/* Add new hospital option */}
                <button
                  onClick={() => setStep("create")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      Add a new hospital
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Can't find your hospital? Add it here
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Create new hospital ─────────────────────────────────── */}
          {step === "create" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center gap-3">
                <button
                  onClick={() => setStep("search")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
                <h2 className="font-semibold text-foreground">
                  Add a new hospital
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Hospital Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Memorial General Hospital"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      City
                    </label>
                    <Input
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      placeholder="San Francisco"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      State
                    </label>
                    <Input
                      value={newState}
                      onChange={(e) => setNewState(e.target.value)}
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Address{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (optional)
                    </span>
                  </label>
                  <Input
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="123 Medical Drive"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Website{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (optional)
                    </span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={newWebsite}
                      onChange={(e) => setNewWebsite(e.target.value)}
                      placeholder="https://hospital.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !newName.trim()}
                  className="w-full h-11"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating account…
                    </>
                  ) : (
                    "Create Hospital & Continue"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Confirm selection ───────────────────────────────────── */}
          {step === "confirm" && selected && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center gap-3">
                <button
                  onClick={() => {
                    setStep("search");
                    setSelected(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
                <h2 className="font-semibold text-foreground">
                  Confirm hospital
                </h2>
              </div>
              <div className="p-6">
                {/* Hospital preview card */}
                <div className="bg-muted/30 rounded-xl p-4 mb-6 space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Hospital Name
                    </span>
                    <p className="font-semibold text-foreground text-lg">
                      {selected.name}
                    </p>
                  </div>
                  {(selected.city || selected.state) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {[selected.city, selected.state]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {selected.website && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <Globe className="h-4 w-4 flex-shrink-0" />
                      <a
                        href={selected.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-primary truncate"
                      >
                        {selected.website}
                      </a>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  You will be added as the{" "}
                  <strong className="text-foreground">owner</strong> of this
                  hospital's account. You can invite additional team members
                  after setup.
                </p>

                {error && (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 mb-4">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-11"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Setting up account…
                    </>
                  ) : (
                    "Confirm & Set Up Account"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
