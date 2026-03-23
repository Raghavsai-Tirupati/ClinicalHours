import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, RefreshCw, ShieldAlert, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

type CloneMode = "full" | "positions_only" | "settings_only";

interface CloneResult {
  success: boolean;
  clone_version: number;
  source_page_id: string;
  target_page_id: string;
  positions_cloned: number;
  questions_cloned: number;
  settings_updated: boolean;
  skipped_existing_positions: number;
}

const DEFAULT_SOURCE = "admin@bcsclinic.org";
const DEFAULT_TARGET = "clinicalhours.org@gmail.com";

export default function AdminCloneTemplateTab() {
  const [sourceEmail, setSourceEmail] = useState(DEFAULT_SOURCE);
  const [targetEmail, setTargetEmail] = useState(DEFAULT_TARGET);
  const [mode, setMode] = useState<CloneMode>("full");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [lastResult, setLastResult] = useState<CloneResult | null>(null);

  const handleClone = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("clone-hospital-template", {
        body: {
          source_admin_email: sourceEmail.trim(),
          target_admin_email: targetEmail.trim(),
          mode,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult(data as CloneResult);
      toast.success(
        isForceUpdate ? "Force update completed" : "Clone completed",
        {
          description: `${data.positions_cloned} positions, ${data.questions_cloned} questions cloned`,
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Clone failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (forceUpdate: boolean) => {
    setIsForceUpdate(forceUpdate);
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Clone Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Clone Hospital Template
          </CardTitle>
          <CardDescription>
            One-time snapshot clone of hospital admin configuration. No auto-sync — target is fully independent after clone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-email">Source Admin Email</Label>
              <Input
                id="source-email"
                value={sourceEmail}
                onChange={(e) => setSourceEmail(e.target.value)}
                placeholder="admin@bcsclinic.org"
              />
              <p className="text-xs text-muted-foreground">
                Hospital page to clone FROM
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-email">Target Admin Email</Label>
              <Input
                id="target-email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="clinicalhours.org@gmail.com"
              />
              <p className="text-xs text-muted-foreground">
                Hospital page to clone INTO (created if missing)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Clone Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as CloneMode)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full (Positions + Questions + Settings)</SelectItem>
                <SelectItem value="positions_only">Positions & Questions Only</SelectItem>
                <SelectItem value="settings_only">Page Settings Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={() => openConfirm(false)}
              disabled={loading || !sourceEmail || !targetEmail}
            >
              <Copy className="h-4 w-4 mr-2" />
              {loading && !isForceUpdate ? "Cloning…" : "Clone Template"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => openConfirm(true)}
              disabled={loading || !sourceEmail || !targetEmail}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {loading && isForceUpdate ? "Updating…" : "Force Update from Source"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Safety Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Safety & Behavior
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Clone is a <strong>point-in-time snapshot</strong> — no ongoing sync.</li>
            <li>Idempotent: positions with matching titles are skipped on re-run.</li>
            <li><strong>Never copies:</strong> student applications, answers, activity logs, Gmail tokens.</li>
            <li>Force update re-runs clone; existing positions with same title are preserved.</li>
            <li>Target page is marked as <Badge variant="outline" className="mx-1 text-xs">showcase</Badge> automatically.</li>
            <li>All clone actions are audit-logged.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Clone Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Positions Cloned</p>
                <p className="text-lg font-semibold">{lastResult.positions_cloned}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Questions Cloned</p>
                <p className="text-lg font-semibold">{lastResult.questions_cloned}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Skipped (Existing)</p>
                <p className="text-lg font-semibold">{lastResult.skipped_existing_positions}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Settings Updated</p>
                <p className="text-lg font-semibold">{lastResult.settings_updated ? "Yes" : "No"}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Schema version: v{lastResult.clone_version} · Source: {lastResult.source_page_id.slice(0, 8)}… · Target: {lastResult.target_page_id.slice(0, 8)}…
            </p>
          </CardContent>
        </Card>
      )}

      {/* Runbook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Runbook
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <p className="font-medium">Clone BCS into business showcase account</p>
            <ol className="list-decimal list-inside text-muted-foreground ml-2 mt-1">
              <li>Set source to <code>admin@bcsclinic.org</code></li>
              <li>Set target to <code>clinicalhours.org@gmail.com</code></li>
              <li>Select "Full" mode → Click "Clone Template"</li>
              <li>Verify result card shows expected counts</li>
            </ol>
          </div>
          <div>
            <p className="font-medium">Perform manual broad update</p>
            <ol className="list-decimal list-inside text-muted-foreground ml-2 mt-1">
              <li>Same source/target as above</li>
              <li>Click "Force Update from Source" → Confirm</li>
              <li>New positions are added; existing titles are skipped</li>
            </ol>
          </div>
          <div>
            <p className="font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Update clone mappings when admin schema changes
            </p>
            <ol className="list-decimal list-inside text-muted-foreground ml-2 mt-1">
              <li>Edit <code>clone-hospital-template/index.ts</code></li>
              <li>Add new fields to <code>POSITION_CLONE_FIELDS</code>, <code>QUESTION_CLONE_FIELDS</code>, or <code>PAGE_SETTINGS_FIELDS</code></li>
              <li>Bump <code>CLONE_SCHEMA_VERSION</code></li>
              <li>Redeploy the edge function</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
