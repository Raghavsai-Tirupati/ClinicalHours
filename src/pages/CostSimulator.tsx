import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { UpgradeCTA } from "@/components/PremiumGate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Calculator, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";
import { APPLICATION_COSTS } from "@/lib/premium";

function CostRow({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}>
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-mono ${highlight ? "text-foreground" : ""}`}>${amount.toLocaleString()}</span>
    </div>
  );
}

const CostSimulator = () => {
  const [mdSchools, setMdSchools] = useState(20);
  const [doSchools, setDoSchools] = useState(0);
  const [txSchools, setTxSchools] = useState(0);
  const [secondaryAvg, setSecondaryAvg] = useState<number>(APPLICATION_COSTS.secondary_avg);
  const [interviews, setInterviews] = useState(8);
  const [interviewCost, setInterviewCost] = useState(500);
  const [takingMCAT, setTakingMCAT] = useState(true);
  const [takingCASPer, setTakingCASPer] = useState(true);
  const [casperPrograms, setCasperPrograms] = useState(10);
  const [msar, setMsar] = useState(true);
  const [transcripts, setTranscripts] = useState(2);
  const [feeAssistance, setFeeAssistance] = useState(false);

  const costs = useMemo(() => {
    const amcas = mdSchools > 0
      ? APPLICATION_COSTS.amcas_first + Math.max(0, mdSchools - 1) * APPLICATION_COSTS.amcas_additional
      : 0;
    const aacomas = doSchools > 0
      ? APPLICATION_COSTS.aacomas_first + Math.max(0, doSchools - 1) * APPLICATION_COSTS.aacomas_additional
      : 0;
    const tmdsas = txSchools > 0 ? APPLICATION_COSTS.tmdsas_flat : 0;
    const secondaries = (mdSchools + doSchools) * secondaryAvg;
    const mcat = takingMCAT ? APPLICATION_COSTS.mcat : 0;
    const casper = takingCASPer
      ? APPLICATION_COSTS.casper_base + Math.max(0, casperPrograms - APPLICATION_COSTS.casper_free_programs) * APPLICATION_COSTS.casper_additional
      : 0;
    const preview = APPLICATION_COSTS.preview;
    const msarCost = msar ? APPLICATION_COSTS.msar : 0;
    const interviewTotal = interviews * interviewCost;
    const transcriptTotal = transcripts * 15;

    let total = amcas + aacomas + tmdsas + secondaries + mcat + casper + preview + msarCost + interviewTotal + transcriptTotal;

    let feeAssistanceSavings = 0;
    if (feeAssistance) {
      feeAssistanceSavings = Math.min(amcas, 1068) + (takingMCAT ? 345 : 0);
      total -= feeAssistanceSavings;
    }

    return {
      amcas,
      aacomas,
      tmdsas,
      secondaries,
      mcat,
      casper,
      preview,
      msarCost,
      interviewTotal,
      transcriptTotal,
      feeAssistanceSavings,
      total,
    };
  }, [mdSchools, doSchools, txSchools, secondaryAvg, interviews, interviewCost, takingMCAT, takingCASPer, casperPrograms, msar, transcripts, feeAssistance]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground font-heading">Application Cost Calculator</h1>
          <p className="text-muted-foreground mt-1">Estimate your total application costs for the 2026 cycle.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Inputs */}
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">School Count</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>MD Schools (AMCAS)</Label>
                  <Input type="number" min={0} max={50} className="mt-1.5" value={mdSchools} onChange={(e) => setMdSchools(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>DO Schools (AACOMAS)</Label>
                  <Input type="number" min={0} max={50} className="mt-1.5" value={doSchools} onChange={(e) => setDoSchools(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Texas (TMDSAS)</Label>
                  <Input type="number" min={0} max={15} className="mt-1.5" value={txSchools} onChange={(e) => setTxSchools(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Testing & Resources</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">MCAT Registration ($345)</p>
                  </div>
                  <Switch checked={takingMCAT} onCheckedChange={setTakingMCAT} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">CASPer ($85 + $18/program after 7)</p>
                  </div>
                  <Switch checked={takingCASPer} onCheckedChange={setTakingCASPer} />
                </div>
                {takingCASPer && (
                  <div className="ml-4">
                    <Label>Number of CASPer programs</Label>
                    <Input type="number" min={1} max={30} className="mt-1.5 w-24" value={casperPrograms} onChange={(e) => setCasperPrograms(parseInt(e.target.value) || 0)} />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">MSAR Subscription ($28)</p>
                  <Switch checked={msar} onCheckedChange={setMsar} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-medium text-foreground mb-4">Additional Costs</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Avg. Secondary Fee ($)</Label>
                  <Input type="number" min={0} max={300} className="mt-1.5" value={secondaryAvg} onChange={(e) => setSecondaryAvg(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Expected Interviews</Label>
                  <Input type="number" min={0} max={30} className="mt-1.5" value={interviews} onChange={(e) => setInterviews(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Avg. Interview Travel ($)</Label>
                  <Input type="number" min={0} max={2000} className="mt-1.5" value={interviewCost} onChange={(e) => setInterviewCost(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Transcript Orders</Label>
                  <Input type="number" min={0} max={10} className="mt-1.5" value={transcripts} onChange={(e) => setTranscripts(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className={`rounded-lg border p-5 ${feeAssistance ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
              <div className="flex items-center gap-3">
                <Switch checked={feeAssistance} onCheckedChange={setFeeAssistance} />
                <div>
                  <p className="text-sm font-medium text-foreground">AAMC Fee Assistance Program (FAP)</p>
                  <p className="text-xs text-muted-foreground">Waives up to $1,068 in AMCAS fees and MCAT registration</p>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium text-foreground">Cost Breakdown</h3>
              </div>

              <div className="divide-y divide-border">
                {costs.amcas > 0 && <CostRow label={`AMCAS (${mdSchools} schools)`} amount={costs.amcas} />}
                {costs.aacomas > 0 && <CostRow label={`AACOMAS (${doSchools} schools)`} amount={costs.aacomas} />}
                {costs.tmdsas > 0 && <CostRow label="TMDSAS" amount={costs.tmdsas} />}
                {costs.secondaries > 0 && <CostRow label={`Secondaries (${mdSchools + doSchools}×$${secondaryAvg})`} amount={costs.secondaries} />}
                {costs.mcat > 0 && <CostRow label="MCAT" amount={costs.mcat} />}
                {costs.casper > 0 && <CostRow label="CASPer" amount={costs.casper} />}
                <CostRow label="PREview" amount={costs.preview} />
                {costs.msarCost > 0 && <CostRow label="MSAR" amount={costs.msarCost} />}
                {costs.interviewTotal > 0 && <CostRow label={`Interviews (${interviews}×$${interviewCost})`} amount={costs.interviewTotal} />}
                {costs.transcriptTotal > 0 && <CostRow label="Transcripts" amount={costs.transcriptTotal} />}
                {costs.feeAssistanceSavings > 0 && (
                  <div className="flex items-center justify-between py-2.5 text-emerald-400">
                    <span className="text-sm">FAP Savings</span>
                    <span className="text-sm font-mono">-${costs.feeAssistanceSavings.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-foreground font-mono">
                    ${costs.total.toLocaleString()}
                  </span>
                </div>
              </div>

              {feeAssistance && costs.feeAssistanceSavings > 0 && (
                <div className="mt-3 rounded-lg bg-emerald-500/10 p-3 flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-300">
                    FAP saves you ${costs.feeAssistanceSavings.toLocaleString()} on AMCAS and MCAT fees.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <UpgradeCTA message="Planning your school list? Premium members get AI-powered school recommendations." />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CostSimulator;
