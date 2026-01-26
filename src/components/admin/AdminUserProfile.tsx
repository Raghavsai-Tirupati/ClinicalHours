import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Clock,
  Activity,
  BookmarkCheck,
  MessageSquare,
  Star,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  ExternalLink,
  Linkedin,
  FileText,
  Target,
  Award,
  Briefcase,
  Send,
  Bell,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';

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

interface FullProfile {
  id: string;
  full_name: string;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  email_opt_in: boolean | null;
  email_verified: boolean | null;
  created_at: string;
  updated_at: string;
  bio: string | null;
  career_goals: string | null;
  certifications: string[] | null;
  gpa: number | null;
  linkedin_url: string | null;
  pre_med_track: string | null;
  research_experience: string | null;
  resume_url: string | null;
}

interface UserActivity {
  saved_total: number;
  active_experiences: number;
  applied: number;
  contacted: number;
  heard_back: number;
  interviews_scheduled: number;
  experience_entries: number;
  total_hours_logged: number;
  reviews: number;
  questions: number;
  answers: number;
  reminders_set: number;
  last_activity: string | null;
}

interface SavedOpportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  is_active: boolean;
  has_deadline: boolean;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

interface ExperienceEntry {
  id: string;
  opportunity_name: string;
  opportunity_type: string;
  entry_date: string;
  hours: number;
  moment: string | null;
  created_at: string;
}

interface Review {
  id: string;
  opportunity_name: string;
  opportunity_type: string;
  rating: number;
  has_comment: boolean;
  created_at: string;
}

interface AdminUserProfileProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdminUserProfile({ user, open, onOpenChange }: AdminUserProfileProps) {
  const [loading, setLoading] = useState(false);
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunity[]>([]);
  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchUserData();
    }
  }, [open, user]);

  async function fetchUserData() {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const profileResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-user-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.success) {
          setFullProfile(profileData.profile);
          setActivity(profileData.activity);
          setSavedOpportunities(profileData.savedOpportunities || []);
          setExperienceEntries(profileData.experienceEntries || []);
          setReviews(profileData.reviews || []);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active Experience': return 'bg-green-500';
      case 'Interview Scheduled': return 'bg-purple-500';
      case 'Heard Back': return 'bg-blue-500';
      case 'Applied': return 'bg-yellow-500';
      case 'Contacted': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin User Profile
          </DialogTitle>
          <DialogDescription>
            Detailed view of user profile and activity
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 pr-4">
              {/* User Header */}
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{user.full_name}</h3>
                  <p className="text-muted-foreground">{user.email}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {user.email_verified ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Email Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        Email Not Verified
                      </Badge>
                    )}
                    {user.email_opt_in ? (
                      <Badge variant="outline" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        Subscribed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        Not Subscribed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>User ID:</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{user.id.slice(0, 8)}...</code>
                </div>
              </div>

              <Separator />

              <Tabs defaultValue="activity" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
                  <TabsTrigger value="hours">Hours Log</TabsTrigger>
                </TabsList>

                {/* Activity Tab */}
                <TabsContent value="activity" className="mt-4 space-y-4">
                  {/* Key Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-2xl font-bold">{activity?.total_hours_logged || 0}</p>
                            <p className="text-xs text-muted-foreground">Hours Logged</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="text-2xl font-bold">{activity?.active_experiences || 0}</p>
                            <p className="text-xs text-muted-foreground">Active Experiences</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                          <BookmarkCheck className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-2xl font-bold">{activity?.saved_total || 0}</p>
                            <p className="text-xs text-muted-foreground">Saved Total</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-yellow-500" />
                          <div>
                            <p className="text-2xl font-bold">{activity?.reviews || 0}</p>
                            <p className="text-xs text-muted-foreground">Reviews</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Application Pipeline */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Application Pipeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-5 gap-2 text-center">
                        <div className="p-2 bg-muted/50 rounded">
                          <p className="text-lg font-semibold">{activity?.saved_total || 0}</p>
                          <p className="text-xs text-muted-foreground">Saved</p>
                        </div>
                        <div className="p-2 bg-orange-500/10 rounded">
                          <p className="text-lg font-semibold text-orange-600">{activity?.contacted || 0}</p>
                          <p className="text-xs text-muted-foreground">Contacted</p>
                        </div>
                        <div className="p-2 bg-yellow-500/10 rounded">
                          <p className="text-lg font-semibold text-yellow-600">{activity?.applied || 0}</p>
                          <p className="text-xs text-muted-foreground">Applied</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded">
                          <p className="text-lg font-semibold text-blue-600">{activity?.heard_back || 0}</p>
                          <p className="text-xs text-muted-foreground">Heard Back</p>
                        </div>
                        <div className="p-2 bg-purple-500/10 rounded">
                          <p className="text-lg font-semibold text-purple-600">{activity?.interviews_scheduled || 0}</p>
                          <p className="text-xs text-muted-foreground">Interviews</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Engagement Stats */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Engagement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                          <span>{activity?.experience_entries || 0} hour entries</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span>{activity?.questions || 0} questions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-muted-foreground" />
                          <span>{activity?.answers || 0} answers</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <span>{activity?.reminders_set || 0} reminders</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Activity */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Account Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Created</span>
                        <span>{formatDateShort(user.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Activity</span>
                        <span>{formatDate(activity?.last_activity || null)}</span>
                      </div>
                      {fullProfile?.updated_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Profile Updated</span>
                          <span>{formatDateShort(fullProfile.updated_at)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Reviews */}
                  {reviews.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Recent Reviews</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {reviews.slice(0, 5).map((review) => (
                            <div key={review.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{review.opportunity_type}</Badge>
                                <span className="truncate max-w-[200px]">{review.opportunity_name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center">
                                  <Star className="h-3 w-3 text-yellow-500 mr-1" />
                                  {review.rating}/5
                                </div>
                                <span className="text-xs text-muted-foreground">{formatDateShort(review.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Contact Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span>{user.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span>{user.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span>
                            {[user.city, user.state].filter(Boolean).join(', ') || 'Not provided'}
                          </span>
                        </div>
                        {fullProfile?.linkedin_url && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">LinkedIn</span>
                            <a 
                              href={fullProfile.linkedin_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Linkedin className="h-3 w-3" />
                              View
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Education */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Education
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">University</span>
                          <span className="text-right max-w-[200px] truncate" title={user.university || ''}>
                            {user.university || 'Not provided'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Major</span>
                          <span className="text-right max-w-[200px] truncate" title={user.major || ''}>
                            {user.major || 'Not provided'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Graduation</span>
                          <span>{user.graduation_year ? `Class of ${user.graduation_year}` : 'Not provided'}</span>
                        </div>
                        {fullProfile?.gpa && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">GPA</span>
                            <span>{fullProfile.gpa.toFixed(2)}</span>
                          </div>
                        )}
                        {fullProfile?.pre_med_track && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pre-Med Track</span>
                            <span>{fullProfile.pre_med_track}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Clinical Experience */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Clinical Experience
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Profile Hours</span>
                          <span className="font-semibold">{user.clinical_hours || 0} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Logged Hours</span>
                          <span className="font-semibold">{activity?.total_hours_logged || 0} hrs</span>
                        </div>
                        {fullProfile?.certifications && fullProfile.certifications.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Certifications</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {fullProfile.certifications.map((cert, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  <Award className="h-3 w-3 mr-1" />
                                  {cert}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Account Info */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Account Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Joined</span>
                          <span>{formatDateShort(user.created_at)}</span>
                        </div>
                        {fullProfile?.updated_at && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Updated</span>
                            <span>{formatDateShort(fullProfile.updated_at)}</span>
                          </div>
                        )}
                        {activity?.last_activity && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Activity</span>
                            <span>{formatDate(activity.last_activity)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Bio & Goals */}
                  {(fullProfile?.bio || fullProfile?.career_goals || fullProfile?.research_experience) && (
                    <div className="space-y-4">
                      {fullProfile?.bio && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Bio</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{fullProfile.bio}</p>
                          </CardContent>
                        </Card>
                      )}
                      {fullProfile?.career_goals && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              Career Goals
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{fullProfile.career_goals}</p>
                          </CardContent>
                        </Card>
                      )}
                      {fullProfile?.research_experience && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Research Experience
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">{fullProfile.research_experience}</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Opportunities Tab */}
                <TabsContent value="opportunities" className="mt-4">
                  {savedOpportunities.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Saved Opportunities ({savedOpportunities.length})</CardTitle>
                        <CardDescription>User's tracked opportunities and their status</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {savedOpportunities.map((opp) => (
                            <div key={opp.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-xs shrink-0">{opp.type}</Badge>
                                <span className="truncate">{opp.name}</span>
                                {opp.location && (
                                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                                    ({opp.location})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge 
                                  variant={opp.is_active ? "default" : "secondary"} 
                                  className={`text-xs ${opp.is_active ? getStatusColor(opp.status) : ''}`}
                                >
                                  {opp.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDateShort(opp.updated_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookmarkCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No saved opportunities yet</p>
                    </div>
                  )}
                </TabsContent>

                {/* Hours Log Tab */}
                <TabsContent value="hours" className="mt-4">
                  {experienceEntries.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Experience Entries ({experienceEntries.length})
                          <span className="ml-2 text-primary font-bold">
                            — {activity?.total_hours_logged || 0} total hours
                          </span>
                        </CardTitle>
                        <CardDescription>Hours logged by this user</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {experienceEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-xs shrink-0">{entry.opportunity_type}</Badge>
                                <span className="truncate">{entry.opportunity_name}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-semibold text-primary">{entry.hours} hrs</span>
                                <span className="text-xs text-muted-foreground">{formatDateShort(entry.entry_date)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No hours logged yet</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
