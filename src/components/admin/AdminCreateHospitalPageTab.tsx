import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Building2,
  Search,
  Loader2,
  Mail,
  MapPin,
  Check,
  X,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

interface HospitalResult {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
}

interface HospitalPage {
  id: string;
  hospital_id: string;
  admin_email: string;
  is_claimed: boolean;
  created_at: string;
  hospitals: { name: string } | null;
}

export default function AdminCreateHospitalPageTab() {
  const { user } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HospitalResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<HospitalResult | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Form state
  const [adminEmail, setAdminEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Existing pages state
  const [pages, setPages] = useState<HospitalPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);

  // Search hospitals on debounced input
  useEffect(() => {
    if (!debouncedSearch.trim() || selectedHospital) return;

    async function searchHospitals() {
      setSearchLoading(true);
      try {
        const term = debouncedSearch.trim().replace(/[%_]/g, '\\$&');
        const { data, error } = await supabase
          .from('hospitals')
          .select('id, name, city, state, address, website')
          .ilike('name', `%${term}%`)
          .order('name')
          .limit(10);

        if (error) throw error;
        setSearchResults(data ?? []);
      } catch (err) {
        console.error('Error searching hospitals:', err);
        toast.error('Failed to search hospitals');
      } finally {
        setSearchLoading(false);
      }
    }

    searchHospitals();
  }, [debouncedSearch, selectedHospital]);

  // Clear results when search is empty
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Fetch existing hospital pages on mount
  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    setPagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('hospital_pages')
        .select('id, hospital_id, admin_email, is_claimed, created_at, hospitals(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = (data ?? []).map((row) => ({
        ...row,
        hospitals: Array.isArray(row.hospitals) ? row.hospitals[0] ?? null : row.hospitals,
      })) as HospitalPage[];

      setPages(normalized);
    } catch (err) {
      console.error('Error fetching hospital pages:', err);
    } finally {
      setPagesLoading(false);
    }
  }

  function selectHospital(hospital: HospitalResult) {
    setSelectedHospital(hospital);
    setSearchQuery(hospital.name);
    setSearchResults([]);
  }

  function clearSelection() {
    setSelectedHospital(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  async function handleSubmit() {
    if (!selectedHospital || !adminEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await supabase.functions.invoke('create-hospital-page', {
        body: {
          hospital_id: selectedHospital.id,
          admin_email: adminEmail.trim().toLowerCase(),
        },
      });

      if (response.error) {
        const errorMsg = response.error.message || 'Failed to create hospital page';
        toast.error(errorMsg);
        return;
      }

      const result = response.data;
      if (!result.success) {
        toast.error(result.error || 'Failed to create hospital page');
        return;
      }

      toast.success(`Hospital page created for ${result.hospital_name}`);
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

  return (
    <div className="space-y-6">
      {/* Creation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Hospital Page
          </CardTitle>
          <CardDescription>
            Search for a hospital and assign an admin email. The hospital will set their own password when they first log in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hospital Search */}
          <div className="space-y-2">
            <Label htmlFor="hospital-search">Hospital</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="hospital-search"
                placeholder="Search hospitals by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedHospital) {
                    setSelectedHospital(null);
                  }
                }}
                className="pl-10"
                disabled={submitting}
              />
              {selectedHospital && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && !selectedHospital && (
              <div className="border rounded-lg overflow-hidden bg-card shadow-md">
                {searchResults.map((hospital) => (
                  <button
                    key={hospital.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                    onClick={() => selectHospital(hospital)}
                  >
                    <p className="font-medium text-sm">{hospital.name}</p>
                    {(hospital.city || hospital.state) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {[hospital.city, hospital.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {searchLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {debouncedSearch.trim() && !searchLoading && searchResults.length === 0 && !selectedHospital && (
              <p className="text-sm text-muted-foreground">No hospitals found</p>
            )}
          </div>

          {/* Selected Hospital Info */}
          {selectedHospital && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="font-medium">{selectedHospital.name}</p>
              </div>
              {selectedHospital.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {selectedHospital.address}
                </p>
              )}
              {(selectedHospital.city || selectedHospital.state) && !selectedHospital.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[selectedHospital.city, selectedHospital.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="admin-email">Hospital Admin Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@hospital.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="pl-10"
                disabled={submitting}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The hospital will use this email to set up their password and access their page.
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedHospital || !adminEmail.trim() || submitting}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Hospital Page
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Hospital Pages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Hospital Pages
              </CardTitle>
              <CardDescription>All hospital pages that have been created</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPages} disabled={pagesLoading}>
              {pagesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagesLoading && pages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : pages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hospital pages created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">
                        {page.hospitals?.name ?? 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {page.admin_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        {page.is_claimed ? (
                          <Badge className="bg-green-500/15 text-green-500 border-green-500/20">
                            <Check className="h-3 w-3 mr-1" />
                            Claimed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                            Unclaimed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(page.created_at), 'MMM d, yyyy')}
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
