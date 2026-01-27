import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { logger } from "@/lib/logger";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { Opportunity, SavedOpportunityWithDetails } from "@/types";
import { calculateDistance } from "@/lib/geolocation";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ExperienceBuilder from "@/components/ExperienceBuilder";
import DashboardVideoShowcase from "@/components/DashboardVideoShowcase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, Trash2, 
  Map, Building2, ClipboardCheck, User, BookOpen, 
  Lightbulb, Target, Heart, MessageCircle, ArrowRight,
  Bookmark, CheckCircle2, Clock, TrendingUp, Globe, UserPlus
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReminderDialog } from "@/components/ReminderDialog";
import OnboardingTutorial from "@/components/tutorial/OnboardingTutorial";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// Extended SavedOpportunity with nested opportunities for Dashboard
interface DashboardSavedOpportunity {
  id: string;
  opportunity_id: string;
  contacted?: boolean;
  applied?: boolean;
  heard_back?: boolean;
  scheduled_interview?: boolean;
  deadline?: string;
  notes?: string;
  is_active_experience?: boolean;
  opportunities?: Opportunity & { distance?: number };
}

const tips = [
  {
    icon: Target,
    title: "Set Clear Goals",
    description: "Aim for 100-200 clinical hours before applying to medical school.",
  },
  {
    icon: Heart,
    title: "Quality Over Quantity",
    description: "Deep, meaningful experiences matter more than simply logging hours.",
  },
  {
    icon: MessageCircle,
    title: "Build Relationships",
    description: "Connect with physicians and staff—they can provide valuable mentorship and letters.",
  },
  {
    icon: BookOpen,
    title: "Reflect & Document",
    description: "Keep a journal of meaningful patient interactions for your application essays.",
  },
];

const Dashboard = () => {
  const { user, loading: authLoading, isReady, isGuest } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [savedOpportunities, setSavedOpportunities] = useState<DashboardSavedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [opportunityToDelete, setOpportunityToDelete] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [showTutorial, setShowTutorial] = useState(false);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  
  // Check for tutorial flag in URL (for guests)
  useEffect(() => {
    if (searchParams.get('showTutorial') === 'true') {
      setShowTutorial(true);
      // Remove the query param from URL without reload
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle OAuth callback tokens and auth redirect
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check for OAuth callback in URL hash (for Google Sign-In redirect to dashboard)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        // Set the session from the OAuth callback
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (data.session && !error) {
          // Clear the hash from the URL
          window.history.replaceState(null, '', window.location.pathname);
          // Session is now set, useAuth will pick it up
          return;
        }
      }
      
      // If no OAuth tokens and auth is ready with no user (and not guest), redirect to auth
      if (isReady && !user && !isGuest) {
        navigate("/auth");
      }
    };
    
    handleAuthCallback();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user, isReady, isGuest, navigate]);

  // Store toast in a ref to avoid recreating fetchData when toast changes
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Memoize fetchData to prevent infinite loops
  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch total hours from experience entries
      const { data: hoursData, error: hoursError } = await supabase
        .from("experience_entries")
        .select("hours")
        .eq("user_id", user.id);

      if (hoursError) throw hoursError;

      const total = (hoursData || []).reduce((sum, entry) => sum + (entry.hours || 0), 0);
      setTotalHours(total);

      // Fetch saved opportunities
      const { data: savedData, error: savedError } = await supabase
        .from("saved_opportunities")
        .select(`
          *,
          opportunities (*)
        `)
        .eq("user_id", user.id);

      if (savedError) throw savedError;
      
      // Process and sort saved opportunities
      let processedSaved = (savedData || []).map((saved: DashboardSavedOpportunity) => {
        const opp = saved.opportunities;
        let distance: number | undefined;
        
        // Calculate distance if user location and opportunity coordinates are available
        if (userLocation && opp?.latitude && opp?.longitude) {
          distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            opp.latitude,
            opp.longitude
          );
        }
        
        return {
          ...saved,
          opportunities: opp ? {
            ...opp,
            distance,
          } : undefined,
        };
      });
      
      // Sort saved opportunities: by distance if available, otherwise alphabetically
      if (userLocation) {
        processedSaved.sort((a: DashboardSavedOpportunity, b: DashboardSavedOpportunity) => {
          const distA = a.opportunities?.distance ?? Infinity;
          const distB = b.opportunities?.distance ?? Infinity;
          if (distA !== Infinity || distB !== Infinity) {
            return distA - distB;
          }
          // If both have no distance, sort alphabetically
          return (a.opportunities?.name || "").localeCompare(b.opportunities?.name || "");
        });
      } else {
        // Sort alphabetically if no location
        processedSaved.sort((a: DashboardSavedOpportunity, b: DashboardSavedOpportunity) => 
          (a.opportunities?.name || "").localeCompare(b.opportunities?.name || "")
        );
      }
      
      setSavedOpportunities(processedSaved);
      
      // Initialize local notes state from saved opportunities
      const notesMap: Record<string, string> = {};
      processedSaved.forEach((saved: DashboardSavedOpportunity) => {
        if (saved.notes) {
          notesMap[saved.id] = saved.notes;
        }
      });
      setLocalNotes(notesMap);
    } catch (error: unknown) {
      logger.error("Error loading dashboard data", error);
      toastRef.current({
        title: "Error loading data",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user?.id, userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    // Wait for auth to be ready before fetching data
    if (isReady && user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData, isReady]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          // Log error but don't show toast - location is optional
          logger.error("Error getting location", error);
          // Location features will work without it, just won't sort by distance
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    }
  }, []);

  const handleRemoveClick = (savedId: string) => {
    setOpportunityToDelete(savedId);
    setDeleteDialogOpen(true);
  };

  const removeFromTracker = async () => {
    if (!opportunityToDelete) return;
    const savedId = opportunityToDelete;
    
    // Optimistic update: remove from local state immediately
    const opportunityToRemove = savedOpportunities.find(s => s.id === savedId);
    setSavedOpportunities(prev => prev.filter(s => s.id !== savedId));
    // Also remove from localNotes
    setLocalNotes(prev => {
      const updated = { ...prev };
      delete updated[savedId];
      return updated;
    });
    
    setDeleteDialogOpen(false);
    const tempOpportunityToDelete = opportunityToDelete;
    setOpportunityToDelete(null);

    try {
      const { error } = await supabase
        .from("saved_opportunities")
        .delete()
        .eq("id", savedId);

      if (error) {
        // Rollback optimistic update only if component is still mounted
        if (isMountedRef.current && opportunityToRemove) {
          setSavedOpportunities(prev => [...prev, opportunityToRemove]);
        }
        throw error;
      }

      toast({
        title: "Removed from tracker",
        description: "Opportunity removed from your tracker",
      });
    } catch (error: unknown) {
      logger.error("Error removing opportunity", error);
      setOpportunityToDelete(tempOpportunityToDelete);
      toast({
        title: "Error removing opportunity",
        description: sanitizeErrorMessage(error) || "Failed to remove opportunity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateTrackerField = async (
    savedId: string,
    field: string,
    value: boolean | string | null
  ) => {
    try {
      const { error } = await supabase
        .from("saved_opportunities")
        .update({ [field]: value })
        .eq("id", savedId);

      if (error) throw error;

      // Update local state immediately
      setSavedOpportunities((prev) =>
        prev.map((item) =>
          item.id === savedId ? { ...item, [field]: value } : item
        )
      );
    } catch (error: unknown) {
      logger.error("Error updating tracker", error);
      toast({
        title: "Error updating tracker",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  // Debounced function to save notes to database
  const saveNotesToDatabase = useDebouncedCallback(
    async (savedId: string, notes: string) => {
      try {
        const { error } = await supabase
          .from("saved_opportunities")
          .update({ notes: notes || null })
          .eq("id", savedId);

        if (error) throw error;

        // Update savedOpportunities state to keep it in sync
        setSavedOpportunities((prev) =>
          prev.map((item) =>
            item.id === savedId ? { ...item, notes: notes || undefined } : item
          )
        );
      } catch (error: unknown) {
        logger.error("Error saving notes", error);
        toast({
          title: "Error saving notes",
          description: sanitizeErrorMessage(error),
          variant: "destructive",
        });
      }
    },
    500
  );

  // Calculate stats
  const trackedCount = savedOpportunities.length;
  const contactedCount = savedOpportunities.filter(s => s.contacted).length;
  const appliedCount = savedOpportunities.filter(s => s.applied).length;
  const interviewCount = savedOpportunities.filter(s => s.scheduled_interview).length;
  
  // Get user's first name for greeting - fetched from profile data
  const [firstName, setFirstName] = useState('there');
  
  // Fetch user's first name from profile
  useEffect(() => {
    const fetchFirstName = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (error) throw error;
        
        if (data?.full_name) {
          // Extract first name from full name
          const name = data.full_name.trim().split(' ')[0];
          setFirstName(name || 'there');
        }
      } catch (error) {
        logger.error("Error fetching user name", error);
      }
    };
    
    fetchFirstName();
  }, [user?.id]);

  // For guests, don't wait for data loading since we'll show demo state
  if (authLoading || !isReady || (!isGuest && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Onboarding Tutorial for new users */}
      {showTutorial && (
        <OnboardingTutorial onComplete={() => setShowTutorial(false)} />
      )}
      
      <Navigation />
      
      {/* Hero Section - Full viewport with stats centered, video peeks from bottom */}
      <section className="relative min-h-screen flex flex-col">
        {/* Guest Banner - Fixed at top */}
        {isGuest && (
          <div className="container mx-auto px-4 pt-24 pb-4">
            <Alert className="bg-primary/5 border-primary/20">
              <UserPlus className="h-4 w-4" />
              <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>You're browsing as a guest. Create an account to save opportunities and track your progress.</span>
                <Button asChild size="sm" variant="default">
                  <Link to="/auth">Sign Up Free</Link>
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Centered Content Area */}
        <div className={`flex-1 flex flex-col justify-center container mx-auto px-4 ${isGuest ? 'pb-48' : 'pt-24 pb-48'}`}>
          {/* Welcome Section - Centered */}
          <div className="text-center mb-10">
            <h1 className="text-3xl lg:text-5xl font-bold text-foreground">
              {isGuest ? "Welcome to ClinicalHours!" : `Welcome back, ${firstName}!`}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Track your clinical journey and find opportunities
            </p>
          </div>

          {/* Quick Stats Cards - Centered */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-5xl mx-auto w-full">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bookmark className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{trackedCount}</p>
                    <p className="text-xs text-muted-foreground">Saved Opportunities</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{appliedCount}</p>
                    <p className="text-xs text-muted-foreground">Applications Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{interviewCount}</p>
                    <p className="text-xs text-muted-foreground">Interviews Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalHours}</p>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Action Buttons - Centered */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link to="/map">
                <Map className="h-6 w-6" />
                <span>Explore Map</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link to="/opportunities">
                <Building2 className="h-6 w-6" />
                <span>Browse All</span>
              </Link>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => document.getElementById('tracker-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <ClipboardCheck className="h-6 w-6" />
              <span>My Tracker</span>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
              <Link to={isGuest ? "/auth" : "/profile"}>
                <User className="h-6 w-6" />
                <span>{isGuest ? "Sign Up" : "My Profile"}</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Video Showcase - Peeks from bottom, half visible */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2">
          <div className="container mx-auto px-4">
            <DashboardVideoShowcase />
          </div>
        </div>
      </section>

      {/* Spacer to account for the video peeking up */}
      <div className="h-[40vh]" />
      
      <main className="flex-1 container mx-auto px-4 pb-8">
        {/* My Opportunities Tracker */}
        <Card id="tracker-section" className="mb-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">My Opportunities Tracker</CardTitle>
            <CardDescription>
              Track your application progress for saved opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isGuest ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                  <UserPlus className="h-8 w-8 text-primary" />
                </div>
                <p className="text-muted-foreground mb-2">
                  Create an account to save and track opportunities.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Keep track of applications, interviews, and notes all in one place.
                </p>
                <Button asChild>
                  <Link to="/auth">
                    Sign Up Free <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : savedOpportunities.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">
                  You haven't added any opportunities to your tracker yet.
                </p>
                <Button asChild>
                  <Link to="/opportunities">
                    Browse Opportunities <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {savedOpportunities.map((saved) => (
                    <div key={saved.id} className="border border-border rounded-lg p-4 space-y-4 bg-card">
                      {/* Header with name, type, and actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">{saved.opportunities.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {saved.opportunities.type === 'emt' ? 'EMT' : saved.opportunities.type.charAt(0).toUpperCase() + saved.opportunities.type.slice(1)}
                            </Badge>
                            {saved.opportunities?.website && (
                              <a
                                href={saved.opportunities.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                              >
                                <Globe className="h-3 w-3" />
                                Website
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <ReminderDialog
                            opportunityId={saved.opportunity_id}
                            opportunityName={saved.opportunities.name}
                            opportunityLocation={saved.opportunities.location}
                            opportunityWebsite={saved.opportunities.website}
                            userId={user?.id || ""}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() => handleRemoveClick(saved.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress checkboxes in a 2x2 grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                          <Checkbox
                            checked={saved.contacted}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "contacted", checked as boolean)
                            }
                            className="h-5 w-5"
                          />
                          <span className="text-sm text-foreground">Contacted</span>
                        </label>
                        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                          <Checkbox
                            checked={saved.applied}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "applied", checked as boolean)
                            }
                            className="h-5 w-5"
                          />
                          <span className="text-sm text-foreground">Applied</span>
                        </label>
                        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                          <Checkbox
                            checked={saved.heard_back}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "heard_back", checked as boolean)
                            }
                            className="h-5 w-5"
                          />
                          <span className="text-sm text-foreground">Heard Back</span>
                        </label>
                        <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                          <Checkbox
                            checked={saved.scheduled_interview}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "scheduled_interview", checked as boolean)
                            }
                            className="h-5 w-5"
                          />
                          <span className="text-sm text-foreground">Interview</span>
                        </label>
                      </div>

                      {/* Deadline and Notes */}
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Deadline</label>
                          <Input
                            type="date"
                            value={saved.deadline || ""}
                            onChange={(e) =>
                              updateTrackerField(saved.id, "deadline", e.target.value || null)
                            }
                            className="w-full h-11"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                          <Input
                            placeholder="Add notes..."
                            value={localNotes[saved.id] ?? saved.notes ?? ""}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setLocalNotes((prev) => ({
                                ...prev,
                                [saved.id]: newValue,
                              }));
                              saveNotesToDatabase(saved.id, newValue);
                            }}
                            className="w-full h-11"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-foreground">Name</TableHead>
                        <TableHead className="text-foreground">Type</TableHead>
                        <TableHead className="text-foreground">Website</TableHead>
                        <TableHead className="text-foreground">Contacted</TableHead>
                        <TableHead className="text-foreground">Applied</TableHead>
                        <TableHead className="text-foreground">Heard Back</TableHead>
                        <TableHead className="text-foreground">Interview</TableHead>
                        <TableHead className="text-foreground">Deadline</TableHead>
                        <TableHead className="text-foreground">Notes</TableHead>
                        <TableHead className="text-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedOpportunities.map((saved) => (
                        <TableRow key={saved.id}>
                          <TableCell className="font-medium text-foreground">
                            {saved.opportunities.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {saved.opportunities.type === 'emt' ? 'EMT' : saved.opportunities.type.charAt(0).toUpperCase() + saved.opportunities.type.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {saved.opportunities?.website ? (
                              <a
                                href={saved.opportunities.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              >
                                <Globe className="h-3 w-3" />
                                Visit
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={saved.contacted}
                              onCheckedChange={(checked) =>
                                updateTrackerField(saved.id, "contacted", checked as boolean)
                              }
                              aria-label={`Mark ${saved.opportunities.name} as contacted`}
                            />
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={saved.applied}
                              onCheckedChange={(checked) =>
                                updateTrackerField(saved.id, "applied", checked as boolean)
                              }
                              aria-label={`Mark ${saved.opportunities.name} as applied`}
                            />
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={saved.heard_back}
                              onCheckedChange={(checked) =>
                                updateTrackerField(saved.id, "heard_back", checked as boolean)
                              }
                              aria-label={`Mark ${saved.opportunities.name} as heard back`}
                            />
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={saved.scheduled_interview}
                              onCheckedChange={(checked) =>
                                updateTrackerField(saved.id, "scheduled_interview", checked as boolean)
                              }
                              aria-label={`Mark ${saved.opportunities.name} as scheduled interview`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={saved.deadline || ""}
                              onChange={(e) =>
                                updateTrackerField(saved.id, "deadline", e.target.value || null)
                              }
                              className="w-40"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Add notes..."
                              value={localNotes[saved.id] ?? saved.notes ?? ""}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                setLocalNotes((prev) => ({
                                  ...prev,
                                  [saved.id]: newValue,
                                }));
                                saveNotesToDatabase(saved.id, newValue);
                              }}
                              className="w-48"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <ReminderDialog
                                opportunityId={saved.opportunity_id}
                                opportunityName={saved.opportunities.name}
                                opportunityLocation={saved.opportunities.location}
                                opportunityWebsite={saved.opportunities.website}
                                userId={user?.id || ""}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveClick(saved.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Experience Builder */}
        <div className="mb-8">
          {isGuest ? (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Experience Builder</CardTitle>
                <CardDescription>
                  Log and track your clinical hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
                    <BookOpen className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-muted-foreground mb-2">
                    Create an account to log your clinical hours.
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track your experiences, calculate total hours, and build your clinical portfolio.
                  </p>
                  <Button asChild>
                    <Link to="/auth">
                      Sign Up Free <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ExperienceBuilder />
          )}
        </div>

        {/* Tips & Resources Section */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <CardTitle className="text-foreground">Tips for Success</CardTitle>
            </div>
            <CardDescription>
              Make the most of your clinical experience journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {tips.map((tip, index) => (
                <div key={index} className="p-4 rounded-lg bg-background/50 border border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <tip.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-medium text-foreground mb-1">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Tracker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this opportunity from your tracker? You can add it back later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeFromTracker}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default Dashboard;
