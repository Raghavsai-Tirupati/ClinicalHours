import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Hospital, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const US_STATES = [
  { value: "all", label: "All States" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const IMPORT_LIMITS = [
  { value: "50", label: "50 hospitals" },
  { value: "100", label: "100 hospitals" },
  { value: "250", label: "250 hospitals" },
  { value: "500", label: "500 hospitals" },
  { value: "1000", label: "1,000 hospitals" },
];

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  message: string;
  error?: string;
}

export default function AdminImportHospitals() {
  const [selectedState, setSelectedState] = useState("all");
  const [limit, setLimit] = useState("100");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(10);
    setResults(null);

    try {
      const body = {
        limit: parseInt(limit),
        state: selectedState === "all" ? null : selectedState,
        offset: 0,
      };

      setProgress(30);
      toast.info("Fetching hospitals from CMS database...");

      const { data, error } = await supabase.functions.invoke('import-hospitals', {
        body,
      });

      setProgress(100);

      if (error) {
        throw error;
      }

      setResults(data as ImportResult);

      if (data.success) {
        toast.success(`Successfully imported ${data.imported} hospitals!`);
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import hospitals. Check console for details.");
      setResults({
        success: false,
        imported: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        message: "Import failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Import Hospitals | Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />

        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
                <Hospital className="h-8 w-8 text-primary" />
                Import Real Hospitals
              </h1>
              <p className="text-muted-foreground">
                Import verified hospitals from the CMS (Centers for Medicare & Medicaid Services) government database
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Import Settings</CardTitle>
                <CardDescription>
                  Configure how many hospitals to import and from which states
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Limit</label>
                    <Select value={limit} onValueChange={setLimit}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select limit" />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_LIMITS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="w-full"
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Hospital className="mr-2 h-4 w-4" />
                      Import Hospitals
                    </>
                  )}
                </Button>

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground text-center">
                      Fetching and geocoding hospitals... This may take a few minutes.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {results && (
              <Card className={results.success ? "border-green-500/50" : "border-destructive/50"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {results.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    Import Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {results.success ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-green-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-green-500">{results.imported}</div>
                          <div className="text-sm text-muted-foreground">Imported</div>
                        </div>
                        <div className="p-4 bg-yellow-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-500">{results.skipped}</div>
                          <div className="text-sm text-muted-foreground">Skipped (duplicates)</div>
                        </div>
                        <div className="p-4 bg-red-500/10 rounded-lg">
                          <div className="text-2xl font-bold text-red-500">{results.failed}</div>
                          <div className="text-sm text-muted-foreground">Failed</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-center">
                        {results.message}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5 mt-0.5" />
                      <div>
                        <p className="font-medium">Import failed</p>
                        <p className="text-sm opacity-80">{results.error}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>About CMS Hospital Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  This tool imports <strong>real, verified hospital data</strong> from the Centers for Medicare & Medicaid Services (CMS) 
                  Hospital General Information dataset.
                </p>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Data includes:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Hospital name, address, and phone number</li>
                    <li>Hospital type and ownership</li>
                    <li>Emergency services availability</li>
                    <li>CMS quality ratings (1-5 stars)</li>
                    <li>Geocoded coordinates for map display</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">5,421+ Hospitals</Badge>
                  <Badge variant="secondary">Government Verified</Badge>
                  <Badge variant="secondary">Updated Regularly</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
