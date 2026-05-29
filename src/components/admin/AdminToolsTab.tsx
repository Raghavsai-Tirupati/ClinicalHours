import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Database,
  Upload,
  MapPin,
  Link2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  Mail,
  Send,
  Wrench,
  Image,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Crown,
  Users,
  Ghost,
  Ticket,
  UserPlus,
  CreditCard,
} from 'lucide-react';
import AdminDuplicateHospitals from './AdminDuplicateHospitals';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface OperationResult {
  success: boolean;
  message: string;
  details?: unknown;
}

export default function AdminToolsTab() {
  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Operation states
  const [fixingStates, setFixingStates] = useState(false);
  const [findingLinks, setFindingLinks] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [fixingCoordinates, setFixingCoordinates] = useState(false);

  // Mass email
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Result banner
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);

  // Limits
  const [fixStatesLimit, setFixStatesLimit] = useState(50);
  const [findLinksLimit, setFindLinksLimit] = useState(25);

  // Confirmation dialog state
  const [showMassEmailConfirm, setShowMassEmailConfirm] = useState(false);
  const [showClearExistingConfirm, setShowClearExistingConfirm] = useState(false);
  const [showRemoveDuplicatesConfirm, setShowRemoveDuplicatesConfirm] = useState(false);
  const [showFixCoordinatesConfirm, setShowFixCoordinatesConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  /** RFC 4180–compliant CSV line parser — handles quoted fields with embedded commas. */
  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  async function fetchSubscriberCount() {
    setLoadingCount(true);
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('email_opt_in', true);
      if (error) throw error;
      setSubscriberCount(count || 0);
    } catch (error) {
      console.error('Error fetching subscriber count:', error);
      toast.error('Failed to fetch subscriber count');
    } finally {
      setLoadingCount(false);
    }
  }

  async function handleSendMassEmail() {
    if (!emailSubject.trim()) { toast.error('Please enter an email subject'); return; }
    if (!emailBody.trim()) { toast.error('Please enter an email body'); return; }
    setSendingEmail(true);
    setOperationResult(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-mass-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ subject: emailSubject, body: emailBody }),
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to send emails');

      setOperationResult({ success: true, message: `Successfully sent emails to ${result.sent} subscribers`, details: result });
      toast.success(`Emails sent to ${result.sent} subscribers!`);
      setEmailSubject('');
      setEmailBody('');
    } catch (error) {
      console.error('Send mass email error:', error);
      setOperationResult({ success: false, message: error instanceof Error ? error.message : 'Failed to send emails' });
      toast.error('Failed to send emails');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleCsvImport() {
    if (!csvFile) { toast.error('Please select a CSV file'); return; }
    if (csvFile.size > 5 * 1024 * 1024) { toast.error('CSV file must be under 5 MB'); return; }

    setImporting(true);
    setImportProgress(0);
    setOperationResult(null);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const opportunities = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < headers.length) continue;
        const opp: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          let value: unknown = values[idx]?.trim().replace(/^"|"$/g, '');
          if (header === 'latitude' || header === 'longitude') value = value ? parseFloat(value as string) : null;
          if (header === 'requirements') value = value ? (value as string).split(';').map(r => r.trim()) : [];
          opp[header] = value;
        });
        opportunities.push(opp);
        setImportProgress(Math.round((i / lines.length) * 50));
      }

      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      setImportProgress(60);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-csv-hospitals`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ opportunities, clearExisting }),
        }
      );
      setImportProgress(90);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Import failed');

      setImportProgress(100);
      setOperationResult({ success: true, message: `Successfully imported ${result.imported} opportunities`, details: result });
      toast.success(`Imported ${result.imported} opportunities`);
    } catch (error) {
      console.error('Import error:', error);
      setOperationResult({ success: false, message: error instanceof Error ? error.message : 'Import failed' });
      toast.error('Import failed');
    } finally {
      setImporting(false);
      setCsvFile(null);
    }
  }

  async function handleFixStates(preview = true) {
    setFixingStates(true);
    setOperationResult(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const action = preview ? 'preview' : 'fix';
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-missing-states?action=${action}&limit=${fixStatesLimit}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Operation failed');
      setOperationResult({
        success: true,
        message: preview
          ? `Found ${result.count} opportunities missing state`
          : `Fixed ${result.fixed} opportunities, ${result.failed} failed`,
        details: result,
      });
      if (!preview) toast.success(`Fixed ${result.fixed} missing states`);
    } catch (error) {
      console.error('Fix states error:', error);
      setOperationResult({ success: false, message: error instanceof Error ? error.message : 'Operation failed' });
      toast.error('Fix states failed');
    } finally {
      setFixingStates(false);
    }
  }

  async function handleFindLinks() {
    setFindingLinks(true);
    setOperationResult(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-missing-links`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ limit: findLinksLimit }),
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Operation failed');
      setOperationResult({
        success: true,
        message: `Processed ${result.processed} opportunities: ${result.updated} updated, ${result.failed} failed`,
        details: result,
      });
      toast.success(`Found links for ${result.updated} opportunities`);
    } catch (error) {
      console.error('Find links error:', error);
      setOperationResult({ success: false, message: error instanceof Error ? error.message : 'Operation failed' });
      toast.error('Find links failed');
    } finally {
      setFindingLinks(false);
    }
  }

  async function handleRemoveDuplicates() {
    setShowRemoveDuplicatesConfirm(false);
    setRemovingDuplicates(true);
    setOperationResult(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-duplicates`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Operation failed');
      setOperationResult({ success: true, message: `Removed ${result.removed} duplicate opportunities`, details: result });
      toast.success(`Removed ${result.removed} duplicates`);
    } catch (error) {
      console.error('Remove duplicates error:', error);
      setOperationResult({ success: false, message: error instanceof Error ? error.message : 'Operation failed' });
      toast.error('Remove duplicates failed');
    } finally {
      setRemovingDuplicates(false);
    }
  }

  async function handleFixCoordinates() {
    setShowFixCoordinatesConfirm(false);
    setFixingCoordinates(true);
    setOperationResult(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fix-coordinates`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Operation failed');
      setOperationResult({ success: true, message: `Fixed coordinates for ${result.fixed || 0} opportunities`, details: result });
      toast.success(`Fixed ${result.fixed || 0} coordinates`);
    } catch (error) {
      console.error('Fix coordinates error:', error);
      setOperationResult({ success: false, message: error instanceof Error ? error.message : 'Operation failed' });
      toast.error('Fix coordinates failed');
    } finally {
      setFixingCoordinates(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Operation Result Banner */}
      {operationResult && (
        <Card className={operationResult.success ? 'border-green-500' : 'border-red-500'}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {operationResult.success
                ? <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                : <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />}
              <div>
                <p className="font-medium">{operationResult.message}</p>
                {operationResult.details && (
                  <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                    {JSON.stringify(operationResult.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="data-quality" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Quality
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="logos" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Logos
          </TabsTrigger>
          <TabsTrigger value="premium" className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Premium
          </TabsTrigger>
        </TabsList>

        {/* Email Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Mass Email
              </CardTitle>
              <CardDescription>
                Send an email to all users who have opted in to receive updates.
                This will only send to users with email notifications enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Mail className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Subscribed Users</p>
                  <p className="text-2xl font-bold">
                    {loadingCount
                      ? <Loader2 className="h-6 w-6 animate-spin" />
                      : subscriberCount !== null ? subscriberCount.toLocaleString() : '—'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchSubscriberCount} disabled={loadingCount} className="ml-auto">
                  {loadingCount ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-subject">Subject</Label>
                  <Input
                    id="email-subject"
                    placeholder="Enter email subject..."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={sendingEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-body">Email Body</Label>
                  <Textarea
                    id="email-body"
                    placeholder={`Write your email content here...\n\nYou can use basic formatting:\n- Line breaks will be preserved\n- Keep it concise and valuable for subscribers`}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    disabled={sendingEmail}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{emailBody.length} characters</p>
                </div>
                <Button
                  onClick={() => setShowMassEmailConfirm(true)}
                  disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                  className="w-full"
                >
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {sendingEmail ? 'Sending...' : 'Send to All Subscribers'}
                </Button>
                <AlertDialog open={showMassEmailConfirm} onOpenChange={setShowMassEmailConfirm}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Send mass email to all subscribers?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will send <strong>"{emailSubject}"</strong> to{' '}
                        {subscriberCount !== null ? <strong>{subscriberCount.toLocaleString()} subscribers</strong> : 'all subscribers'}.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSendMassEmail}>Send Email</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-sm text-muted-foreground">
                  ⚠️ This will send an email to all users who have opted in.
                  Make sure your content is ready before sending.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                CSV Import
              </CardTitle>
              <CardDescription>
                Import opportunities from a CSV file. The CSV should have headers matching
                the database columns (name, type, location, latitude, longitude, phone, email, website, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  disabled={importing}
                  className="mt-1"
                />
                {csvFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clear-existing"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  disabled={importing}
                  className="rounded border-input"
                />
                <Label htmlFor="clear-existing" className="text-destructive font-medium">
                  ⚠️ Clear ALL existing opportunities before import
                </Label>
              </div>
              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {importProgress < 50 ? 'Parsing CSV...' : importProgress < 90 ? 'Uploading to database...' : 'Finalizing...'}
                  </p>
                </div>
              )}
              <Button
                onClick={() => clearExisting ? setShowClearExistingConfirm(true) : handleCsvImport()}
                disabled={!csvFile || importing}
                className="w-full"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? 'Importing...' : 'Import CSV'}
              </Button>
              <AlertDialog open={showClearExistingConfirm} onOpenChange={(o) => { setShowClearExistingConfirm(o); if (!o) setDeleteConfirmText(''); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">Delete ALL existing opportunities?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete every opportunity in the database before importing the CSV.
                      Type <strong>DELETE</strong> below to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    placeholder="Type DELETE to confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-2"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCsvImport}
                      disabled={deleteConfirmText !== 'DELETE'}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete All &amp; Import
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Quality Tab */}
        <TabsContent value="data-quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Fix Missing States
              </CardTitle>
              <CardDescription>
                Use reverse geocoding to add state information to locations that are missing it.
                This uses Mapbox API to look up states from coordinates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fix-states-limit">Limit (max opportunities to process)</Label>
                <Input
                  id="fix-states-limit"
                  type="number"
                  min={1}
                  max={500}
                  value={fixStatesLimit}
                  onChange={(e) => setFixStatesLimit(parseInt(e.target.value) || 50)}
                  disabled={fixingStates}
                  className="mt-1 w-32"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleFixStates(true)} disabled={fixingStates}>
                  {fixingStates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Preview
                </Button>
                <Button onClick={() => handleFixStates(false)} disabled={fixingStates}>
                  {fixingStates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Fix States
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Find Missing Links
              </CardTitle>
              <CardDescription>
                Search the web to find official websites and contact emails for opportunities
                that are missing them. Uses DuckDuckGo search and web scraping.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="find-links-limit">Limit (max opportunities to process)</Label>
                <Input
                  id="find-links-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={findLinksLimit}
                  onChange={(e) => setFindLinksLimit(parseInt(e.target.value) || 25)}
                  disabled={findingLinks}
                  className="mt-1 w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ This operation is slow (2.5s delay between requests to avoid rate limits)
                </p>
              </div>
              <Button onClick={handleFindLinks} disabled={findingLinks}>
                {findingLinks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                {findingLinks ? 'Searching...' : 'Find Missing Links'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Fix Missing Coordinates
              </CardTitle>
              <CardDescription>
                Geocode addresses to add latitude/longitude for opportunities missing coordinates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowFixCoordinatesConfirm(true)} disabled={fixingCoordinates}>
                {fixingCoordinates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                {fixingCoordinates ? 'Fixing...' : 'Fix Coordinates'}
              </Button>
              <AlertDialog open={showFixCoordinatesConfirm} onOpenChange={setShowFixCoordinatesConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fix missing coordinates?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will geocode addresses and update latitude/longitude for all opportunities missing coordinates.
                      The operation writes to the database and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFixCoordinates}>Fix Coordinates</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-6">
          <AdminDuplicateHospitals />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Remove Opportunity Duplicates
              </CardTitle>
              <CardDescription>
                Find and remove duplicate opportunities based on matching name and location.
                Keeps the oldest record and removes newer duplicates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setShowRemoveDuplicatesConfirm(true)} disabled={removingDuplicates}>
                {removingDuplicates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {removingDuplicates ? 'Processing...' : 'Remove Duplicates'}
              </Button>
              <AlertDialog open={showRemoveDuplicatesConfirm} onOpenChange={setShowRemoveDuplicatesConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove duplicate opportunities?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete duplicate opportunity records (by matching name + location), keeping only the oldest entry.
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveDuplicates} className="bg-destructive hover:bg-destructive/90">
                      Remove Duplicates
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logos Tab */}
        <TabsContent value="logos">
          <LogosSection />
        </TabsContent>

        {/* Premium Tab */}
        <TabsContent value="premium">
          <PremiumSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Logos Section (inlined from AdminLogosTab) ───────────────

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

function LogosSection() {
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
    const { count: total } = await supabase.from('opportunities').select('*', { count: 'exact', head: true });
    const { count: withLogos } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).not('logo_url', 'is', null).neq('logo_url', '');
    const { count: withoutLogos } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).or('logo_url.is.null,logo_url.eq.');
    const { count: withWebsite } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).is('logo_url', null).not('website', 'is', null);
    setStats({ total: total ?? 0, withLogos: withLogos ?? 0, withoutLogos: withoutLogos ?? 0, withWebsite: withWebsite ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const invokeBatch = async (): Promise<BatchResult | null> => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sysbtcikrbrrgafffody';
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/batch-fetch-logos`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || anonKey}`,
        },
      });
      if (!res.ok) return null;
      return (await res.json()) as BatchResult;
    } catch { return null; }
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
      if (result.processed === 0) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    setRunning(false);
  };

  const pct = stats.total > 0 ? Math.round((stats.withLogos / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Listings', value: stats.total, color: '' },
          { label: 'With Logos', value: stats.withLogos, color: 'text-green-500' },
          { label: 'Without Logos', value: stats.withoutLogos, color: 'text-amber-500' },
          { label: 'Fetchable', value: stats.withWebsite, color: 'text-blue-500' },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardDescription>{s.label}</CardDescription></CardHeader>
            <CardContent><p className={`text-2xl font-bold ${s.color}`}>{loading ? '…' : s.value.toLocaleString()}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" />Logo Coverage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} className="h-3" />
          <p className="text-sm text-muted-foreground">{pct}% of listings have logos</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Batch Logo Fetch</CardTitle>
          <CardDescription>Fetches logos for listings that have a website but no logo. Processes 30 per batch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={runSingleBatch} disabled={singleRunning || running} variant="outline">
              {singleRunning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running…</> : <><Image className="h-4 w-4 mr-2" />Fetch Single Batch</>}
            </Button>
            {!running ? (
              <Button onClick={runLoop} disabled={singleRunning}><Play className="h-4 w-4 mr-2" />Run Continuous Loop</Button>
            ) : (
              <Button onClick={() => { stopRef.current = true; }} variant="destructive"><Square className="h-4 w-4 mr-2" />Stop</Button>
            )}
          </div>
          {(totalProcessed > 0 || running) && (
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2"><Badge variant="secondary">Processed</Badge><span className="font-mono text-lg">{totalProcessed}</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="font-mono text-lg">{totalSuccess}</span></div>
              <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-500" /><span className="font-mono text-lg">{totalFailed}</span></div>
              <div className="flex items-center gap-2"><Badge variant="outline">Remaining</Badge><span className="font-mono text-lg">{stats.withWebsite.toLocaleString()}</span></div>
            </div>
          )}
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

// ── Premium Section (inlined from AdminPremiumTab) ───────────

type PremiumProfileLite = {
  id: string;
  full_name: string | null;
  is_premium: boolean;
  stripe_subscription_id: string | null;
  premium_expires_at: string | null;
  premium_source: 'paid' | 'promo_code' | 'directly_added' | null;
};

type PremiumTrackingEvent = {
  id: string;
  user_id: string | null;
  session_id: string;
  page_url: string;
  created_at: string;
};

type SubscriptionLite = {
  user_id: string;
  status: string;
};

function PremiumSection() {
  const [premiumProfiles, setPremiumProfiles] = useState<PremiumProfileLite[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<{ userId: string; name: string; lastVisit: string }[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionLite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: events }, { data: subs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, is_premium, stripe_subscription_id, premium_expires_at, premium_source').eq('is_premium', true).order('premium_expires_at', { ascending: false }),
        supabase.from('tracking_events').select('id, user_id, session_id, page_url, created_at').eq('page_url', '/premium').not('user_id', 'is', null).order('created_at', { ascending: false }).limit(100),
        supabase.from('subscriptions').select('user_id, status').eq('status', 'active'),
      ]);

      setPremiumProfiles((profiles ?? []) as PremiumProfileLite[]);
      setSubscriptions((subs ?? []) as SubscriptionLite[]);

      if (events && events.length > 0) {
        const userIds = [...new Set((events as PremiumTrackingEvent[]).filter((e) => e.user_id).map((e) => e.user_id!))];
        const { data: profilesForVisitors } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        const nameMap = new Map((profilesForVisitors ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
        const seen = new Set<string>();
        const visitors: { userId: string; name: string; lastVisit: string }[] = [];
        for (const e of events as PremiumTrackingEvent[]) {
          if (!e.user_id || seen.has(e.user_id)) continue;
          seen.add(e.user_id);
          visitors.push({ userId: e.user_id, name: nameMap.get(e.user_id) ?? `User ${e.user_id.slice(0, 6)}`, lastVisit: e.created_at });
        }
        setRecentVisitors(visitors.slice(0, 20));
      }
    } catch (err) {
      console.error('Error fetching premium data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sourceLabel = (source: PremiumProfileLite['premium_source']) => {
    switch (source) {
      case 'paid': return 'Paid';
      case 'promo_code': return 'Promo';
      case 'directly_added': return 'Admin';
      default: return '—';
    }
  };

  const sourceColor = (source: PremiumProfileLite['premium_source']) => {
    switch (source) {
      case 'paid': return 'border-green-500/30 text-green-400';
      case 'promo_code': return 'border-blue-500/30 text-blue-400';
      case 'directly_added': return 'border-purple-500/30 text-purple-400';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-400" />
          <h3 className="text-base font-semibold">Premium Users</h3>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold tabular-nums">{premiumProfiles.length}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Crown className="h-3 w-3 text-amber-400" />Premium users</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold tabular-nums">{subscriptions.length}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><CreditCard className="h-3 w-3 text-green-400" />Active subscriptions</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold tabular-nums">{recentVisitors.length}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Users className="h-3 w-3 text-blue-400" />Recent page visitors</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            Premium Members
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : premiumProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No premium users.</p>
          ) : (
            <ScrollArea className="h-[320px]">
              <div className="divide-y divide-border/40">
                {premiumProfiles.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <span className="text-sm font-medium truncate">{p.full_name ?? `User ${p.id.slice(0, 6)}`}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${sourceColor(p.premium_source)}`}>{sourceLabel(p.premium_source)}</Badge>
                      {p.premium_expires_at && (
                        <span className="text-[11px] text-muted-foreground">
                          Expires {formatDistanceToNow(new Date(p.premium_expires_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            Recent Premium Page Visitors
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : recentVisitors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent visitors.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {recentVisitors.map((v) => (
                <div key={v.userId} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                  <span className="text-sm truncate">{v.name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(v.lastVisit), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
