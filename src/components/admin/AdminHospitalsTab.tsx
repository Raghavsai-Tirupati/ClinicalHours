import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { toast } from 'sonner';
import {
  Building2,
  Search,
  RefreshCw,
  Loader2,
  Mail,
  Globe,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Eye,
  Briefcase,
  Users,
  Phone,
  Plus,
  Check,
  X,
  Pause,
  Play,
  Archive,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useDebounce } from '@/hooks/useDebounce';
import { Textarea } from '@/components/ui/textarea';

// ── Hospital Accounts Section ──────────────────────────────

interface HospitalRow {
  id: string;
  user_id: string;
  hospital_id: string | null;
  hospital_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
  reviewed_at: string | null;
  opportunityCount: number;
  applicantCount: number;
}

interface HospitalOpportunity {
  id: string;
  name: string;
  location: string;
  type: string;
  created_at: string;
  applicationCount: number;
}

interface ApplicantRow {
  id: string;
  name: string;
  email: string;
  opportunityName: string;
  appliedAt: string;
  status: string;
  source: 'legacy' | 'hospital';
}

// ── Hospital Pages Section ──────────────────────────────

interface OpportunityResult {
  id: string;
  name: string;
  location: string;
  type: string;
  website: string | null;
}

interface HospitalPage {
  id: string;
  hospital_id: string;
  admin_email: string;
  is_claimed: boolean;
  created_at: string;
  page_status: string;
  opportunities: { name: string; location: string } | null;
}

const PAGE_SIZE = 20;

interface AdminHospitalsTabProps {
  onPendingCountChange?: (count: number) => void;
}

export default function AdminHospitalsTab({ onPendingCountChange }: AdminHospitalsTabProps) {
  const [pendingCount, setPendingCount] = useState(0);

  function handlePendingCount(count: number) {
    setPendingCount(count);
    onPendingCountChange?.(count);
  }

  return (
    <Tabs defaultValue="pages" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pages">Hospital Pages</TabsTrigger>
        <TabsTrigger value="accounts">Hospital Accounts</TabsTrigger>
        <TabsTrigger value="pending" className="flex items-center gap-1.5">
          Pending Approvals
          {pendingCount > 0 && (
            <Badge className="h-5 min-w-[1.25rem] bg-yellow-500 px-1.5 py-0 text-xs text-white">
              {pendingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      <TabsContent value="pages">
        <HospitalPagesSection />
      </TabsContent>
      <TabsContent value="accounts">
        <HospitalAccountsSection />
      </TabsContent>
      <TabsContent value="pending">
        <PendingApprovalsSection onPendingCountChange={handlePendingCount} />
      </TabsContent>
      <TabsContent value="notifications">
        <HospitalNotificationsSection />
      </TabsContent>
    </Tabs>
  );
}

// ── Hospital Notifications Log ──────────────────────────────

interface NotificationLogRow {
  id: string;
  sent_at: string;
  hospital_name: string;
  hospital_page_id: string | null;
  admin_email: string;
  applicant_name: string | null;
  applicant_email: string | null;
  position_title: string | null;
  status: string;
}

function HospitalNotificationsSection() {
  const [rows, setRows] = useState<NotificationLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE_NOTIF = 50;

  async function fetchLogs(p = page) {
    setLoading(true);
    const from = p * PAGE_SIZE_NOTIF;
    const to = from + PAGE_SIZE_NOTIF - 1;
    const { data, count, error } = await supabase
      .from('admin_notification_log')
      .select('*', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(from, to);
    if (!error) {
      setRows((data as NotificationLogRow[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }

  useEffect(() => { fetchLogs(0); }, []);

  function handlePage(next: number) {
    setPage(next);
    fetchLogs(next);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE_NOTIF);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Hospital Notification Log
          </CardTitle>
          <CardDescription>
            Every email sent to a hospital admin when a new application is received.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No notifications sent yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(row.sent_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell className="font-medium">{row.hospital_name}</TableCell>
                    <TableCell className="text-sm">{row.admin_email}</TableCell>
                    <TableCell className="text-sm">
                      <div>{row.applicant_name ?? '—'}</div>
                      {row.applicant_email && (
                        <div className="text-xs text-muted-foreground">{row.applicant_email}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{row.position_title ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'sent' ? 'default' : 'destructive'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>{total} total</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePage(page - 1)} disabled={page === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 py-1">Page {page + 1} of {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => handlePage(page + 1)} disabled={page >= totalPages - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Hospital Pages (merged from AdminCreateHospitalPageTab) ──

function HospitalPagesSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OpportunityResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityResult | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [adminEmail, setAdminEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pages, setPages] = useState<HospitalPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ pageId: string; action: 'pause' | 'activate' | 'archive'; pageName: string } | null>(null);

  useEffect(() => {
    if (!debouncedSearch.trim() || selectedOpportunity) return;
    async function searchOpportunities() {
      setSearchLoading(true);
      try {
        const term = debouncedSearch.trim().replace(/[%_\\]/g, '\\$&');
        const searchPattern = `%${term}%`;
        const { data, error } = await supabase
          .from('opportunities')
          .select('id, name, location, type, website')
          .or(`name.ilike.${searchPattern.replace(/,/g, '\\,')},location.ilike.${searchPattern.replace(/,/g, '\\,')}`)
          .order('name')
          .limit(15);
        if (error) throw error;
        setSearchResults(data ?? []);
      } catch (err) {
        console.error('Error searching opportunities:', err);
        toast.error('Failed to search opportunities');
      } finally {
        setSearchLoading(false);
      }
    }
    searchOpportunities();
  }, [debouncedSearch, selectedOpportunity]);

  useEffect(() => {
    if (!searchQuery.trim()) setSearchResults([]);
  }, [searchQuery]);

  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    setPagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('hospital_pages')
        .select('id, hospital_id, admin_email, is_claimed, created_at, page_status, opportunities:hospital_id(name, location)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const normalized = (data ?? []).map((row) => ({
        ...row,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        page_status: (row as any).page_status ?? 'active',
        opportunities: Array.isArray(row.opportunities) ? row.opportunities[0] ?? null : row.opportunities,
      })) as HospitalPage[];
      setPages(normalized);
    } catch (err) {
      console.error('Error fetching hospital pages:', err);
    } finally {
      setPagesLoading(false);
    }
  }

  function selectOpportunity(opportunity: OpportunityResult) {
    setSelectedOpportunity(opportunity);
    setSearchQuery(opportunity.name);
    setSearchResults([]);
  }

  function clearSelection() {
    setSelectedOpportunity(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function handleSubmit() {
    if (!selectedOpportunity || !adminEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('create-hospital-page', {
        body: {
          hospital_id: selectedOpportunity.id,
          admin_email: adminEmail.trim().toLowerCase(),
        },
      });
      if (response.error) {
        toast.error(response.error.message || 'Failed to create hospital page');
        return;
      }
      const result = response.data;
      if (!result.success) {
        toast.error(result.error || 'Failed to create hospital page');
        return;
      }
      toast.success(`Hospital page created for ${result.opportunity_name}`);
      clearSelection();
      setAdminEmail('');
      fetchPages();
    } catch (err) {
      console.error('Error creating hospital page:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange() {
    if (!confirmAction) return;
    const newStatus = confirmAction.action === 'pause' ? 'paused' : confirmAction.action === 'archive' ? 'archived' : 'active';
    try {
      const { error } = await supabase
        .from('hospital_pages')
        .update({ page_status: newStatus } as Record<string, unknown>)
        .eq('id', confirmAction.pageId);
      if (error) throw error;
      toast.success(`${confirmAction.pageName} ${newStatus === 'active' ? 'activated' : newStatus}`);
      fetchPages();
    } catch (err) {
      console.error('Error updating page status:', err);
      toast.error('Failed to update page status');
    } finally {
      setConfirmAction(null);
    }
  }

  const statusBadge = (status: string, isClaimed: boolean) => {
    if (status === 'paused') {
      return (
        <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/20">
          <Pause className="h-3 w-3 mr-1" />
          Paused
        </Badge>
      );
    }
    if (status === 'archived') {
      return (
        <Badge className="bg-muted text-muted-foreground border-border">
          <Archive className="h-3 w-3 mr-1" />
          Archived
        </Badge>
      );
    }
    if (isClaimed) {
      return (
        <Badge className="bg-green-500/15 text-green-500 border-green-500/20">
          <Check className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
        Unclaimed
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'pause' ? 'Pause Hospital Page?' : confirmAction?.action === 'archive' ? 'Archive Hospital Page?' : 'Reactivate Hospital Page?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'pause'
                ? `This will temporarily take down "${confirmAction.pageName}". The hospital admin will not be able to access their dashboard. You can reactivate it anytime.`
                : confirmAction?.action === 'archive'
                ? `This will archive "${confirmAction.pageName}". The page will be hidden from the hospital admin.`
                : `This will reactivate "${confirmAction?.pageName}" and restore access for the hospital admin.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange}>
              {confirmAction?.action === 'pause' ? 'Pause' : confirmAction?.action === 'archive' ? 'Archive' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Creation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Hospital Page
          </CardTitle>
          <CardDescription>
            Search for a hospital and assign an admin email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hospital-search">Hospital / Clinic</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="hospital-search"
                placeholder="Search by name or location..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedOpportunity) setSelectedOpportunity(null);
                }}
                className="pl-10"
                disabled={submitting}
              />
              {selectedOpportunity && (
                <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={clearSelection}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {searchResults.length > 0 && !selectedOpportunity && (
              <div className="border rounded-lg overflow-hidden bg-card shadow-md max-h-80 overflow-y-auto">
                {searchResults.map((opp) => (
                  <button key={opp.id} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0" onClick={() => selectOpportunity(opp)}>
                    <p className="font-medium text-sm">{opp.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{opp.location}</p>
                      <Badge variant="outline" className="text-xs capitalize">{opp.type}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Searching...
              </div>
            )}
            {debouncedSearch.trim() && !searchLoading && searchResults.length === 0 && !selectedOpportunity && (
              <p className="text-sm text-muted-foreground">No results found</p>
            )}
          </div>

          {selectedOpportunity && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="font-medium">{selectedOpportunity.name}</p>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />{selectedOpportunity.location}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-email">Hospital Admin Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="admin-email" type="email" placeholder="admin@hospital.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="pl-10" disabled={submitting} />
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!selectedOpportunity || !adminEmail.trim() || submitting} className="w-full sm:w-auto">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : <><Plus className="h-4 w-4 mr-2" />Create Hospital Page</>}
          </Button>
        </CardContent>
      </Card>

      {/* Pages List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Hospital Pages
              </CardTitle>
              <CardDescription>{pages.length} hospital pages</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPages} disabled={pagesLoading}>
              {pagesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto overflow-x-auto-touch">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagesLoading && pages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : pages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hospital pages created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  pages.map((page) => (
                    <TableRow key={page.id} className={page.page_status === 'archived' ? 'opacity-50' : ''}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{page.opportunities?.name ?? 'Unknown'}</p>
                          {page.opportunities?.location && (
                            <p className="text-xs text-muted-foreground">{page.opportunities.location}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-0 max-w-[12rem] break-all sm:max-w-none">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {page.admin_email}
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(page.page_status, page.is_claimed)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(page.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {page.page_status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ pageId: page.id, action: 'pause', pageName: page.opportunities?.name ?? 'Unknown' })}
                            >
                              <Pause className="h-3 w-3 mr-1" />
                              Pause
                            </Button>
                          )}
                          {page.page_status === 'paused' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmAction({ pageId: page.id, action: 'activate', pageName: page.opportunities?.name ?? 'Unknown' })}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Activate
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmAction({ pageId: page.id, action: 'archive', pageName: page.opportunities?.name ?? 'Unknown' })}
                              >
                                <Archive className="h-3 w-3 mr-1" />
                                Archive
                              </Button>
                            </>
                          )}
                          {page.page_status === 'archived' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ pageId: page.id, action: 'activate', pageName: page.opportunities?.name ?? 'Unknown' })}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Hospital Accounts (original) ──────────────────────────────

function HospitalAccountsSection() {
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedHospital, setSelectedHospital] = useState<HospitalRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerOpportunities, setDrawerOpportunities] = useState<HospitalOpportunity[]>([]);
  const [drawerApplicants, setDrawerApplicants] = useState<ApplicantRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    fetchHospitals();
  }, [currentPage]);

  async function fetchHospitals(search = searchTerm) {
    setLoading(true);
    try {
      let query = supabase
        .from('hospital_accounts')
        .select(
          'id, hospital_id, contact_email, contact_phone, description, created_at, reviewed_at, hospitals(name, website, address)',
          { count: 'exact' }
        )
        .eq('account_status', 'approved')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);
      if (search.trim()) {
        query = query.ilike('contact_email', `%${search.trim()}%`);
      }
      const { data: rawData, error, count } = await query;
      if (error) throw error;
      if (!rawData?.length) {
        setHospitals([]);
        setTotalCount(count ?? 0);
        setLoading(false);
        return;
      }
      const accountIds = rawData.map((r) => r.id);
      const { data: owners } = await supabase.from('hospital_members').select('account_id, user_id').in('account_id', accountIds).eq('role', 'owner');
      const accountToUser = new Map<string, string>();
      (owners || []).forEach((o) => accountToUser.set(o.account_id, o.user_id));
      const base = rawData.map((r) => {
        const h = r.hospitals as { name?: string; website?: string; address?: string } | null;
        return {
          id: r.id,
          user_id: accountToUser.get(r.id) ?? '',
          hospital_id: (r as { hospital_id?: string }).hospital_id ?? null,
          hospital_name: h?.name ?? 'Unknown',
          contact_email: r.contact_email ?? '',
          contact_phone: r.contact_phone,
          website: h?.website ?? null,
          address: h?.address ?? null,
          description: r.description,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
        };
      });
      const enriched: HospitalRow[] = await Promise.all(
        base.map(async (h) => {
          const { data: oppsByHospital } = h.hospital_id ? await supabase.from('opportunities').select('id').eq('hospital_id', h.hospital_id) : { data: null };
          const { data: oppsByUser } = h.user_id ? await supabase.from('opportunities').select('id').eq('created_by', h.user_id) : { data: null };
          const oppIdsSet = new Set([...((oppsByHospital || []).map((o) => o.id)), ...((oppsByUser || []).map((o) => o.id))]);
          const oppIds = Array.from(oppIdsSet);
          let applicantCount = 0;
          if (oppIds.length > 0) {
            const { count: appCount } = await supabase.from('applications').select('*', { count: 'exact', head: true }).in('opportunity_id', oppIds);
            applicantCount = appCount ?? 0;
          }
          const { count: haCount } = await supabase.from('hospital_applications').select('*', { count: 'exact', head: true }).eq('account_id', h.id);
          applicantCount += haCount ?? 0;
          return { ...h, opportunityCount: oppIds.length, applicantCount };
        })
      );
      setHospitals(enriched);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Error fetching hospitals:', err);
      toast.error('Failed to fetch hospitals');
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { new: 'New', submitted: 'New', under_review: 'Under Review', in_review: 'Under Review', accepted: 'Accepted', rejected: 'Rejected' };
    return m[s] ?? s;
  };

  async function openDrawer(hospital: HospitalRow) {
    setSelectedHospital(hospital);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerOpportunities([]);
    setDrawerApplicants([]);
    try {
      const { data: oppsByHospital } = hospital.hospital_id
        ? await supabase.from('opportunities').select('id, name, location, type, created_at').eq('hospital_id', hospital.hospital_id).order('created_at', { ascending: false })
        : { data: null };
      const { data: oppsByUser } = hospital.user_id
        ? await supabase.from('opportunities').select('id, name, location, type, created_at').eq('created_by', hospital.user_id).order('created_at', { ascending: false })
        : { data: null };
      const seen = new Set<string>();
      const oppsList: { id: string; name: string; location: string; type: string; created_at: string }[] = [];
      for (const o of oppsByHospital || []) { if (!seen.has(o.id)) { seen.add(o.id); oppsList.push(o); } }
      for (const o of oppsByUser || []) { if (!seen.has(o.id)) { seen.add(o.id); oppsList.push(o); } }
      oppsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const enrichedOpps: HospitalOpportunity[] = await Promise.all(
        oppsList.map(async (o) => {
          const { count: appCount } = await supabase.from('applications').select('*', { count: 'exact', head: true }).eq('opportunity_id', o.id);
          const { count: haCount } = await supabase.from('hospital_applications').select('*', { count: 'exact', head: true }).eq('account_id', hospital.id).eq('opportunity_id', o.id);
          return { ...o, type: o.type || 'hospital', applicationCount: (appCount ?? 0) + (haCount ?? 0) };
        })
      );
      setDrawerOpportunities(enrichedOpps);
      const oppIdToName = new Map(oppsList.map((o) => [o.id, o.name]));
      const applicants: ApplicantRow[] = [];
      if (oppsList.length > 0) {
        const oppIds = oppsList.map((o) => o.id);
        const { data: legacyApps } = await supabase.from('applications').select('id, student_name, student_email, opportunity_id, created_at, status').in('opportunity_id', oppIds).order('created_at', { ascending: false });
        (legacyApps || []).forEach((a) => {
          applicants.push({ id: a.id, name: a.student_name, email: a.student_email ?? '', opportunityName: oppIdToName.get(a.opportunity_id) ?? '—', appliedAt: a.created_at, status: statusLabel(a.status ?? 'new'), source: 'legacy' });
        });
      }
      const { data: haApps } = await supabase.from('hospital_applications').select('id, applicant_name, applicant_email, opportunity_id, submitted_at, status').eq('account_id', hospital.id).order('submitted_at', { ascending: false });
      (haApps || []).forEach((ha) => {
        applicants.push({ id: ha.id, name: ha.applicant_name ?? '—', email: ha.applicant_email ?? '', opportunityName: ha.opportunity_id ? oppIdToName.get(ha.opportunity_id) ?? '—' : 'Direct application', appliedAt: ha.submitted_at, status: statusLabel(ha.status ?? 'submitted'), source: 'hospital' });
      });
      applicants.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
      setDrawerApplicants(applicants);
    } catch (err) {
      console.error('Error fetching hospital details:', err);
    } finally {
      setDrawerLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const handleSearch = () => { setCurrentPage(1); fetchHospitals(searchTerm); };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Approved Hospital Accounts
        </CardTitle>
        <CardDescription>Hospitals that signed up and were approved</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input placeholder="Search by email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            <Button variant="outline" onClick={handleSearch} disabled={loading}><Search className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{totalCount} accounts</span>
            <Button variant="outline" size="sm" onClick={() => fetchHospitals()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-x-auto overflow-x-auto-touch">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Hospital</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Opportunities</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && hospitals.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : hospitals.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No approved hospitals found</TableCell></TableRow>
              ) : (
                hospitals.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{h.hospital_name}</p>
                        {h.website && (
                          <a href={h.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5">
                            <Globe className="h-3 w-3" />{h.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 max-w-[14rem] break-all sm:max-w-none">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm"><Mail className="h-3 w-3 shrink-0 text-muted-foreground" />{h.contact_email}</div>
                        {h.contact_phone && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3 w-3" />{h.contact_phone}</div>}
                      </div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-1"><Briefcase className="h-3 w-3 text-muted-foreground" /><span className="font-medium">{h.opportunityCount}</span></div></TableCell>
                    <TableCell><div className="flex items-center gap-1"><Users className="h-3 w-3 text-muted-foreground" /><span className="font-medium">{h.applicantCount}</span></div></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(h.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openDrawer(h)}><Eye className="h-4 w-4 mr-1" />View</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 1 || loading}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage === totalPages || loading}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </CardContent>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {selectedHospital && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{selectedHospital.hospital_name}</SheetTitle>
                <SheetDescription>{selectedHospital.contact_email}</SheetDescription>
              </SheetHeader>
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 mb-6">
                {selectedHospital.contact_phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{selectedHospital.contact_phone}</span></div>}
                {selectedHospital.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{selectedHospital.address}</span></div>}
                {selectedHospital.website && <div className="flex items-start gap-2 text-sm min-w-0"><Globe className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" /><a href={selectedHospital.website} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-primary hover:underline">{selectedHospital.website}</a></div>}
                {selectedHospital.description && <p className="text-sm text-muted-foreground mt-2">{selectedHospital.description}</p>}
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                  <span>Registered: {format(new Date(selectedHospital.created_at), 'MMM d, yyyy')}</span>
                  {selectedHospital.reviewed_at && <span>Approved: {format(new Date(selectedHospital.reviewed_at), 'MMM d, yyyy')}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedHospital.opportunityCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Opportunities</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedHospital.applicantCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Applicants</p>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">Opportunities</h3>
                {drawerLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : drawerOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No opportunities posted yet</p>
                ) : (
                  <div className="space-y-2">
                    {drawerOpportunities.map((opp) => (
                      <div key={opp.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-medium text-sm">{opp.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">{opp.type}</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{opp.location}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold">{opp.applicationCount}</p>
                          <p className="text-xs text-muted-foreground">applicants</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" />Applicants ({drawerApplicants.length})</h3>
                {drawerLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : drawerApplicants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No applicants yet</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto overflow-x-auto-touch">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Opportunity</TableHead>
                          <TableHead>Applied</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drawerApplicants.slice(0, 50).map((a) => (
                          <TableRow key={`${a.source}-${a.id}`}>
                            <TableCell className="min-w-0 font-medium break-words">{a.name}</TableCell>
                            <TableCell className="min-w-0"><a href={`mailto:${a.email}`} className="break-all text-primary hover:underline flex items-start gap-1"><Mail className="h-3 w-3 shrink-0 mt-0.5" />{a.email}</a></TableCell>
                            <TableCell className="min-w-0 break-words text-sm text-muted-foreground" title={a.opportunityName}>{a.opportunityName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(a.appliedAt), 'MMM d, yyyy')}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{a.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {drawerApplicants.length > 50 && <p className="text-xs text-muted-foreground text-center py-2 border-t">Showing first 50 of {drawerApplicants.length} applicants</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

// ── Pending Approvals Section (inlined from AdminPendingApprovalsTab) ──

interface PendingHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
}

interface ReviewedHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  account_status: string;
  admin_note: string | null;
  reviewed_at: string;
}

interface PendingApprovalsSectionProps {
  onPendingCountChange?: (count: number) => void;
}

function PendingApprovalsSection({ onPendingCountChange }: PendingApprovalsSectionProps) {
  const [pending, setPending] = useState<PendingHospital[]>([]);
  const [reviewed, setReviewed] = useState<ReviewedHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingHospital | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchData();
    pollingRef.current = setInterval(fetchData, 60_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function fetchData() {
    setFetchError(null);
    try {
      const [{ data: pendingData, error: e1 }, { data: reviewedData, error: e2 }] = await Promise.all([
        supabase
          .from('hospital_accounts')
          .select('id, contact_email, contact_phone, description, created_at, hospitals(name, website, address)')
          .eq('account_status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('hospital_accounts')
          .select('id, contact_email, account_status, admin_note, reviewed_at, hospitals(name)')
          .in('account_status', ['approved', 'rejected'])
          .not('reviewed_at', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(50),
      ]);
      if (e1 || e2) throw e1 ?? e2;
      const newPending = (pendingData || []).map((r: any) => {
        const h = Array.isArray(r.hospitals) ? r.hospitals[0] : r.hospitals;
        return {
          id: r.id,
          hospital_name: h?.name ?? 'Unknown',
          contact_email: r.contact_email ?? '',
          contact_phone: r.contact_phone,
          website: h?.website ?? null,
          address: h?.address ?? null,
          description: r.description,
          created_at: r.created_at,
        };
      }) as PendingHospital[];
      setPending(newPending);
      setReviewed(
        (reviewedData || []).map((r: any) => {
          const h = Array.isArray(r.hospitals) ? r.hospitals[0] : r.hospitals;
          return {
            id: r.id,
            hospital_name: h?.name ?? 'Unknown',
            contact_email: r.contact_email ?? '',
            account_status: r.account_status,
            admin_note: r.admin_note,
            reviewed_at: r.reviewed_at,
          };
        }) as ReviewedHospital[]
      );
      onPendingCountChange?.(newPending.length);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function callHospitalReview(hospitalId: string, action: 'approve' | 'reject', note?: string) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hospital-review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hospitalId, action, note }),
      }
    );
    const result = await res.json();
    if (!result.success) throw new Error(result.error || `${action} failed`);
    return result;
  }

  async function handleApprove(hospital: PendingHospital) {
    setProcessingId(hospital.id);
    try {
      await callHospitalReview(hospital.id, 'approve');
      setPending((prev) => {
        const next = prev.filter((h) => h.id !== hospital.id);
        onPendingCountChange?.(next.length);
        return next;
      });
      toast.success(`${hospital.hospital_name} approved`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    const target = rejectTarget;
    const note = rejectNote.trim() || undefined;
    setProcessingId(target.id);
    try {
      await callHospitalReview(target.id, 'reject', note);
      setPending((prev) => {
        const next = prev.filter((h) => h.id !== target.id);
        onPendingCountChange?.(next.length);
        return next;
      });
      setRejectTarget(null);
      setRejectNote('');
      toast.success(`${target.hospital_name} rejected`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <XCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Pending Hospital Approvals
                {pending.length > 0 && <Badge className="bg-yellow-500 text-white ml-1">{pending.length}</Badge>}
              </CardTitle>
              <CardDescription>Review and approve or reject new hospital account registrations</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending hospital approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((hospital) => (
                <div key={hospital.id} className="bg-muted/20 border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="break-words font-semibold text-foreground">{hospital.hospital_name}</p>
                    </div>
                    <div className="space-y-1 mt-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />{hospital.contact_email}
                      </p>
                      {hospital.website && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3 flex-shrink-0" />
                          <a href={hospital.website} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-primary hover:underline">{hospital.website}</a>
                        </p>
                      )}
                      {hospital.address && <p className="text-sm text-muted-foreground">{hospital.address}</p>}
                      {hospital.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{hospital.description}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Submitted {formatDistanceToNow(new Date(hospital.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 sm:flex-col">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                      onClick={() => handleApprove(hospital)}
                      disabled={processingId === hospital.id}
                    >
                      {processingId === hospital.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      onClick={() => { setRejectTarget(hospital); setRejectNote(''); }}
                      disabled={processingId === hospital.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setShowHistory((v) => !v)}>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Review History ({reviewed.length})
            </span>
            {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {reviewed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No reviews yet</p>
            ) : (
              <div className="space-y-0">
                {reviewed.map((h) => (
                  <div key={h.id} className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="break-words font-medium text-sm">{h.hospital_name}</p>
                        <Badge variant={h.account_status === 'approved' ? 'default' : 'destructive'} className="text-xs flex-shrink-0">{h.account_status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.contact_email}</p>
                      {h.admin_note && <p className="text-xs text-muted-foreground mt-1 italic">Note: {h.admin_note}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">{format(new Date(h.reviewed_at), 'MMM d, yyyy')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectNote(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Hospital Account</AlertDialogTitle>
            <AlertDialogDescription>
              Reject <strong>{rejectTarget?.hospital_name}</strong>? They will receive a notification email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Optional: note explaining rejection (included in email)..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRejectTarget(null); setRejectNote(''); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processingId !== null}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
