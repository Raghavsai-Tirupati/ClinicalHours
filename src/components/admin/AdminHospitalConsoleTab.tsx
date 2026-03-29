import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isSuperAdmin } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Building2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface HospitalPageRow {
  id: string;
  admin_email: string;
  is_claimed: boolean;
  page_status: string;
  opportunities: { name: string; location: string } | null;
}

function statusBadge(status: string, isClaimed: boolean) {
  if (status === 'paused') {
    return <Badge variant="outline" className="text-amber-600 border-amber-500/40">Paused</Badge>;
  }
  if (status === 'archived') {
    return <Badge variant="secondary">Archived</Badge>;
  }
  if (isClaimed) {
    return <Badge variant="outline" className="text-emerald-600 border-emerald-500/40">Claimed</Badge>;
  }
  return <Badge variant="outline">Unclaimed</Badge>;
}

export default function AdminHospitalConsoleTab() {
  const { user } = useAuth();
  const superUser = isSuperAdmin(user?.email);
  const [pages, setPages] = useState<HospitalPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hospital_pages')
        .select('id, admin_email, is_claimed, page_status, opportunities:hospital_id(name, location)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const normalized = (data ?? []).map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        const opp = r.opportunities;
        const opportunities = Array.isArray(opp) ? opp[0] ?? null : opp;
        return {
          id: r.id as string,
          admin_email: r.admin_email as string,
          is_claimed: Boolean(r.is_claimed),
          page_status: (r.page_status as string) ?? 'active',
          opportunities: opportunities as { name: string; location: string } | null,
        };
      });
      setPages(normalized);
    } catch (e) {
      console.error(e);
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => {
      const name = p.opportunities?.name?.toLowerCase() ?? '';
      const loc = p.opportunities?.location?.toLowerCase() ?? '';
      const email = p.admin_email?.toLowerCase() ?? '';
      const id = p.id.toLowerCase();
      return name.includes(q) || loc.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [pages, debounced]);

  const sub = (pageId: string, path: string) => `/hospital/${pageId}${path}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5" />
            Clinic admin consoles
          </CardTitle>
          <CardDescription className="text-pretty break-words">
            Open the same dashboard clinic admins use (overview, positions, applicants, email, settings).
            Super-admins can access every clinic, including paused or archived pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!superUser && (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Super-admin only</AlertTitle>
              <AlertDescription>
                Opening another clinic&apos;s dashboard requires the platform super-admin account. You can
                still manage records from the <strong>Hospitals</strong> tab.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by clinic name, location, admin email, or page ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border [-webkit-overflow-scrolling:touch]">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead className="hidden md:table-cell">Admin email</TableHead>
                  <TableHead className="hidden lg:table-cell">Status</TableHead>
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && pages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin inline-block mr-2 align-middle" />
                      Loading hospital pages…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No pages match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const name = p.opportunities?.name ?? '—';
                    const loc = p.opportunities?.location ?? '';
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[min(100vw-8rem,28rem)]">
                          <div className="font-medium break-words">{name}</div>
                          {loc ? <div className="text-xs text-muted-foreground break-words">{loc}</div> : null}
                          <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground md:hidden">
                            {p.admin_email}
                          </div>
                          <div className="lg:hidden mt-1">{statusBadge(p.page_status, p.is_claimed)}</div>
                        </TableCell>
                        <TableCell className="hidden max-w-xs break-all md:table-cell text-sm text-muted-foreground">
                          {p.admin_email}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {statusBadge(p.page_status, p.is_claimed)}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <div className="flex max-w-[16rem] flex-col gap-2 sm:ml-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-end sm:gap-1">
                            {superUser ? (
                              <>
                                <Button variant="default" size="sm" asChild>
                                  <Link to={`/hospital/${p.id}`}>Open dashboard</Link>
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1">
                                      Jump to
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '')}>Overview</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '/positions')}>Positions</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '/applications')}>Applicants</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '/interviews')}>Interviews</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '/email')}>Email</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '/activity')}>Activity</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={sub(p.id, '/settings')}>Settings</Link>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
