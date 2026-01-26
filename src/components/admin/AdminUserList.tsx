import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  Mail,
  MailX,
  GraduationCap,
  Calendar,
  Phone,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import AdminUserProfile from './AdminUserProfile';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  email_opt_in: boolean;
  email_verified: boolean;
  created_at: string;
}

export default function AdminUserList() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const pageSize = 20;

  async function fetchUsers() {
    setLoading(true);
    try {
      // Get auth token for admin API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Fetch profiles + emails via admin edge function (service role)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            page: currentPage,
            pageSize,
            searchTerm: searchTerm.trim(),
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'Failed to fetch users');
      }

      const result = await response.json();
      const profiles = result.profiles || [];
      const emailMap: Record<string, string> = result.emails || {};
      const count = result.total || 0;

      // Combine profile data with emails
      const combinedUsers: UserProfile[] = profiles.map((profile: UserProfile) => ({
        id: profile.id,
        email: emailMap[profile.id] || 'N/A',
        full_name: profile.full_name || 'Unknown',
        university: profile.university,
        major: profile.major,
        graduation_year: profile.graduation_year,
        city: profile.city,
        state: profile.state,
        phone: profile.phone,
        clinical_hours: profile.clinical_hours,
        email_opt_in: profile.email_opt_in || false,
        email_verified: profile.email_verified || false,
        created_at: profile.created_at,
      }));

      setUsers(combinedUsers);
      setTotalCount(count);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchUsers();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Directory
        </CardTitle>
        <CardDescription>
          View all registered users and their profile information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Stats Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="Search by name, university, or major..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {totalCount} total users
            </span>
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Education</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {user.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {user.phone}
                          </div>
                        )}
                        {!user.phone && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {user.university && (
                          <div className="flex items-center gap-1 text-sm">
                            <GraduationCap className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[150px]" title={user.university}>
                              {user.university}
                            </span>
                          </div>
                        )}
                        {user.major && (
                          <p className="text-sm text-muted-foreground truncate max-w-[150px]" title={user.major}>
                            {user.major}
                          </p>
                        )}
                        {user.graduation_year && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Class of {user.graduation_year}
                          </div>
                        )}
                        {!user.university && !user.major && !user.graduation_year && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.city || user.state ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {[user.city, user.state].filter(Boolean).join(', ')}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.email_opt_in ? (
                          <Badge variant="default" className="w-fit text-xs">
                            <Mail className="h-3 w-3 mr-1" />
                            Subscribed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="w-fit text-xs">
                            <MailX className="h-3 w-3 mr-1" />
                            Not subscribed
                          </Badge>
                        )}
                        {user.clinical_hours && user.clinical_hours > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {user.clinical_hours} clinical hrs
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setProfileOpen(true);
                        }}
                      >
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
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* User Profile Dialog */}
        <AdminUserProfile
          user={selectedUser}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      </CardContent>
    </Card>
  );
}
