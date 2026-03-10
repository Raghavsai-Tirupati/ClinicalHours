import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
} from 'lucide-react';
import { format } from 'date-fns';

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

const PAGE_SIZE = 20;

export default function AdminHospitalsTab() {
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
      const { data: owners } = await supabase
        .from('hospital_members')
        .select('account_id, user_id')
        .in('account_id', accountIds)
        .eq('role', 'owner');

      const accountToUser = new Map<string, string>();
      (owners || []).forEach((o) => accountToUser.set(o.account_id, o.user_id));

      const base: { id: string; user_id: string; hospital_id: string | null; hospital_name: string; contact_email: string; contact_phone: string | null; website: string | null; address: string | null; description: string | null; created_at: string; reviewed_at: string | null }[] = rawData.map((r) => {
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
          const { data: oppsByHospital } = h.hospital_id
            ? await supabase.from('opportunities').select('id').eq('hospital_id', h.hospital_id)
            : { data: null };
          const { data: oppsByUser } = h.user_id
            ? await supabase.from('opportunities').select('id').eq('created_by', h.user_id)
            : { data: null };
          const oppIdsSet = new Set([
            ...((oppsByHospital || []).map((o) => o.id)),
            ...((oppsByUser || []).map((o) => o.id)),
          ]);
          const oppIds = Array.from(oppIdsSet);

          let applicantCount = 0;
          if (oppIds.length > 0) {
            const { count: appCount } = await supabase
              .from('applications')
              .select('*', { count: 'exact', head: true })
              .in('opportunity_id', oppIds);
            applicantCount = appCount ?? 0;
          }
          const { count: haCount } = await supabase
            .from('hospital_applications')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', h.id);
          applicantCount += haCount ?? 0;

          return {
            ...h,
            opportunityCount: oppIds.length,
            applicantCount,
          };
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
    const m: Record<string, string> = {
      new: 'New',
      submitted: 'New',
      under_review: 'Under Review',
      in_review: 'Under Review',
      accepted: 'Accepted',
      rejected: 'Rejected',
    };
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
        ? await supabase
            .from('opportunities')
            .select('id, name, location, type, created_at')
            .eq('hospital_id', hospital.hospital_id)
            .order('created_at', { ascending: false })
        : { data: null };
      const { data: oppsByUser } = hospital.user_id
        ? await supabase
            .from('opportunities')
            .select('id, name, location, type, created_at')
            .eq('created_by', hospital.user_id)
            .order('created_at', { ascending: false })
        : { data: null };
      const seen = new Set<string>();
      const oppsList: { id: string; name: string; location: string; type: string; created_at: string }[] = [];
      for (const o of oppsByHospital || []) {
        if (!seen.has(o.id)) {
          seen.add(o.id);
          oppsList.push(o);
        }
      }
      for (const o of oppsByUser || []) {
        if (!seen.has(o.id)) {
          seen.add(o.id);
          oppsList.push(o);
        }
      }
      oppsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const enrichedOpps: HospitalOpportunity[] = await Promise.all(
        oppsList.map(async (o) => {
          const { count: appCount } = await supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('opportunity_id', o.id);
          const { count: haCount } = await supabase
            .from('hospital_applications')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', hospital.id)
            .eq('opportunity_id', o.id);
          return {
            ...o,
            type: o.type || 'hospital',
            applicationCount: (appCount ?? 0) + (haCount ?? 0),
          };
        })
      );
      setDrawerOpportunities(enrichedOpps);

      const oppIdToName = new Map(oppsList.map((o) => [o.id, o.name]));
      const applicants: ApplicantRow[] = [];

      if (oppsList.length > 0) {
        const oppIds = oppsList.map((o) => o.id);
        const { data: legacyApps } = await supabase
          .from('applications')
          .select('id, student_name, student_email, opportunity_id, created_at, status')
          .in('opportunity_id', oppIds)
          .order('created_at', { ascending: false });
        (legacyApps || []).forEach((a) => {
          applicants.push({
            id: a.id,
            name: a.student_name,
            email: a.student_email ?? '',
            opportunityName: oppIdToName.get(a.opportunity_id) ?? '—',
            appliedAt: a.created_at,
            status: statusLabel(a.status ?? 'new'),
            source: 'legacy',
          });
        });
      }

      const { data: haApps } = await supabase
        .from('hospital_applications')
        .select('id, applicant_name, applicant_email, opportunity_id, submitted_at, status')
        .eq('account_id', hospital.id)
        .order('submitted_at', { ascending: false });
      (haApps || []).forEach((ha) => {
        applicants.push({
          id: ha.id,
          name: ha.applicant_name ?? '—',
          email: ha.applicant_email ?? '',
          opportunityName: ha.opportunity_id
            ? oppIdToName.get(ha.opportunity_id) ?? '—'
            : 'Direct application',
          appliedAt: ha.submitted_at,
          status: statusLabel(ha.status ?? 'submitted'),
          source: 'hospital',
        });
      });

      applicants.sort(
        (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
      );
      setDrawerApplicants(applicants);
    } catch (err) {
      console.error('Error fetching hospital details:', err);
    } finally {
      setDrawerLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchHospitals(searchTerm);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Approved Hospitals
        </CardTitle>
        <CardDescription>All verified hospital accounts on the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="outline" onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{totalCount} hospitals</span>
            <Button variant="outline" size="sm" onClick={() => fetchHospitals()} disabled={loading}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hospital</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Opportunities</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No approved hospitals found
                  </TableCell>
                </TableRow>
              ) : (
                hospitals.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{h.hospital_name}</p>
                        {h.website && (
                          <a
                            href={h.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5"
                          >
                            <Globe className="h-3 w-3" />
                            {h.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {h.contact_email}
                        </div>
                        {h.contact_phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {h.contact_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{h.opportunityCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{h.applicantCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(h.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {h.reviewed_at ? format(new Date(h.reviewed_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openDrawer(h)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {selectedHospital && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedHospital.hospital_name}
                </SheetTitle>
                <SheetDescription>{selectedHospital.contact_email}</SheetDescription>
              </SheetHeader>

              {/* Hospital info */}
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 mb-6">
                {selectedHospital.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{selectedHospital.contact_phone}</span>
                  </div>
                )}
                {selectedHospital.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{selectedHospital.address}</span>
                  </div>
                )}
                {selectedHospital.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={selectedHospital.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {selectedHospital.website}
                    </a>
                  </div>
                )}
                {selectedHospital.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selectedHospital.description}</p>
                )}
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                  <span>Registered: {format(new Date(selectedHospital.created_at), 'MMM d, yyyy')}</span>
                  {selectedHospital.reviewed_at && (
                    <span>Approved: {format(new Date(selectedHospital.reviewed_at), 'MMM d, yyyy')}</span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedHospital.opportunityCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Opportunities Posted</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{selectedHospital.applicantCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Applicants</p>
                </div>
              </div>

              {/* Opportunities list */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3">Posted Opportunities</h3>
                {drawerLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : drawerOpportunities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No opportunities posted yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {drawerOpportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{opp.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">
                              {opp.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {opp.location}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(opp.created_at), 'MMM d, yyyy')}
                          </p>
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

              {/* Applicants list */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Applicants ({drawerApplicants.length})
                </h3>
                {drawerLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : drawerApplicants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No applicants yet
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
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
                            <TableCell className="font-medium">{a.name}</TableCell>
                            <TableCell>
                              <a
                                href={`mailto:${a.email}`}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Mail className="h-3 w-3" />
                                {a.email}
                              </a>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate" title={a.opportunityName}>
                              {a.opportunityName}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {format(new Date(a.appliedAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {a.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {drawerApplicants.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2 border-t">
                        Showing first 50 of {drawerApplicants.length} applicants
                      </p>
                    )}
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
