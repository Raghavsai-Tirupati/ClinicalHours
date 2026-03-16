import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Image, Play, Square, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BatchResult {
  processed: number;
  success: number;
  failed: number;
}

interface LogoStats {
  total: number;
  withLogos: number;
  withoutLogos: number;
  withWebsite: number;
}

export default function AdminLogosTab() {
  const [stats, setStats] = useState<LogoStats>({ total: 0, withLogos: 0, withoutLogos: 0, withWebsite: 0 });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [singleRunning, setSingleRunning] = useState(false);
  const [batchLog, setBatchLog] = useState<BatchResult[]>([]);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalSuccess, setTotalSuccess] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);
  const stopRef = useRef(false);

  const fetchStats = useCallback(async () => {
    const { count: total } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true });

    const { count: withLogos } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .not('logo_url', 'is', null);

    const { count: withoutLogos } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .is('logo_url', null);

    const { count: withWebsite } = await supabase
      .from('opportunities')
      .select('*', { count: 'exact', head: true })
      .is('logo_url', null)
      .not('website', 'is', null);

    setStats({
      total: total ?? 0,
      withLogos: withLogos ?? 0,
      withoutLogos: withoutLogos ?? 0,
      withWebsite: withWebsite ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const invokeBatch = async (): Promise<BatchResult | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/batch-fetch-logos`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Batch fetch error:', err);
      return null;
    }

    return res.json();
  };

  const runSingleBatch = async () => {
    setSingleRunning(true);
    const result = await invokeBatch();
    if (result) {
      setBatchLog((prev) => [result, ...prev]);
      setTotalProcessed((p) => p + result.processed);
      setTotalSuccess((p) => p + result.success);
      setTotalFailed((p) => p + result.failed);
    }
    await fetchStats();
    setSingleRunning(false);
  };

  const runLoop = async () => {
    stopRef.current = false;
    setRunning(true);
    setBatchLog([]);
    setTotalProcessed(0);
    setTotalSuccess(0);
    setTotalFailed(0);

    while (!stopRef.current) {
      const result = await invokeBatch();
      if (!result) break;

      setBatchLog((prev) => [result, ...prev]);
      setTotalProcessed((p) => p + result.processed);
      setTotalSuccess((p) => p + result.success);
      setTotalFailed((p) => p + result.failed);
      await fetchStats();

      // Stop if nothing left to process
      if (result.processed === 0) break;

      // 2-second delay between batches
      await new Promise((r) => setTimeout(r, 2000));
    }

    setRunning(false);
  };

  const stopLoop = () => {
    stopRef.current = true;
  };

  const pct = stats.total > 0 ? Math.round((stats.withLogos / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Listings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? '…' : stats.total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>With Logos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{loading ? '…' : stats.withLogos.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Without Logos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{loading ? '…' : stats.withoutLogos.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fetchable (has website)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">{loading ? '…' : stats.withWebsite.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Logo Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} className="h-3" />
          <p className="text-sm text-muted-foreground">{pct}% of listings have logos</p>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Logo Fetch</CardTitle>
          <CardDescription>
            Fetches logos for listings that have a website but no logo. Processes 30 per batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={runSingleBatch}
              disabled={singleRunning || running}
              variant="outline"
            >
              {singleRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Image className="h-4 w-4 mr-2" />
                  Fetch Single Batch
                </>
              )}
            </Button>

            {!running ? (
              <Button onClick={runLoop} disabled={singleRunning}>
                <Play className="h-4 w-4 mr-2" />
                Run Continuous Loop
              </Button>
            ) : (
              <Button onClick={stopLoop} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>

          {/* Live counters */}
          {(totalProcessed > 0 || running) && (
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Processed</Badge>
                <span className="font-mono text-lg">{totalProcessed}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-mono text-lg">{totalSuccess}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="font-mono text-lg">{totalFailed}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Remaining</Badge>
                <span className="font-mono text-lg">{stats.withWebsite.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Batch log */}
          {batchLog.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border p-3 bg-muted/30 space-y-1">
              {batchLog.map((b, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">
                  Batch #{batchLog.length - i}: {b.processed} processed, {b.success} success, {b.failed} failed
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
