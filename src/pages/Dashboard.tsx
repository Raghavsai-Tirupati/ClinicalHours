import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, MapPin, Phone, Mail, Globe, Bell, CalendarPlus } from "lucide-react";
import { ReminderDialog } from "@/components/ReminderDialog";
import { downloadIcsFile, createOpportunityReminder } from "@/lib/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  address?: string;
  requirements?: string[];
  hours_required: string;
  acceptance_likelihood: string;
  website?: string;
  email?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
}

interface SavedOpportunity {
  id: string;
  opportunity_id: string;
  contacted: boolean;
  applied: boolean;
  heard_back: boolean;
  scheduled_interview: boolean;
  deadline?: string;
  notes?: string;
  opportunities: Opportunity;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all opportunities
      const { data: oppsData, error: oppsError } = await supabase
        .from("opportunities")
        .select("*")
        .order("name");

      if (oppsError) throw oppsError;

      let processedOpps = oppsData || [];
      
      // Calculate distances if location available
      if (userLocation) {
        processedOpps = processedOpps.map((opp) => ({
          ...opp,
          distance: opp.latitude && opp.longitude
            ? calculateDistance(
                userLocation.lat,
                userLocation.lon,
                opp.latitude,
                opp.longitude
              )
            : undefined,
        }));
        processedOpps.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      }

      setOpportunities(processedOpps);

      // Fetch saved opportunities
      const { data: savedData, error: savedError } = await supabase
        .from("saved_opportunities")
        .select(`
          *,
          opportunities (*)
        `)
        .eq("user_id", user?.id);

      if (savedError) throw savedError;
      setSavedOpportunities(savedData || []);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const addToTracker = async (opportunityId: string) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to add opportunities to your tracker",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("saved_opportunities")
        .insert({
          user_id: user.id,
          opportunity_id: opportunityId,
        });

      if (error) {
        // Handle duplicate entry error
        if (error.code === '23505') {
          toast({
            title: "Already tracked",
            description: "This opportunity is already in your tracker",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Added to tracker",
        description: "Opportunity added to your personal tracker",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error adding opportunity",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removeFromTracker = async (savedId: string) => {
    try {
      const { error } = await supabase
        .from("saved_opportunities")
        .delete()
        .eq("id", savedId);

      if (error) throw error;

      toast({
        title: "Removed from tracker",
        description: "Opportunity removed from your tracker",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error removing opportunity",
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: "Error updating tracker",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || opp.type === typeFilter;
    const notSaved = !savedOpportunities.some((s) => s.opportunity_id === opp.id);
    return matchesSearch && matchesType && notSaved;
  });

  const getAcceptanceColor = (likelihood: string) => {
    switch (likelihood) {
      case "high":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "low":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground">
            Track your clinical opportunity applications and progress
          </p>
        </div>

        {/* My Opportunities Tracker */}
        <Card className="mb-8 bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">My Opportunities Tracker</CardTitle>
            <CardDescription>
              Track your application progress for saved opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {savedOpportunities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  You haven't added any opportunities to your tracker yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Add opportunities from the list below to start tracking.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground">Name</TableHead>
                      <TableHead className="text-foreground">Type</TableHead>
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
                          <Badge variant="outline" className="capitalize">
                            {saved.opportunities.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.contacted}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "contacted", checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.applied}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "applied", checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.heard_back}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "heard_back", checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={saved.scheduled_interview}
                            onCheckedChange={(checked) =>
                              updateTrackerField(saved.id, "scheduled_interview", checked as boolean)
                            }
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
                            value={saved.notes || ""}
                            onChange={(e) =>
                              updateTrackerField(saved.id, "notes", e.target.value)
                            }
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
                              onClick={() => removeFromTracker(saved.id)}
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
            )}
          </CardContent>
        </Card>

        {/* Available Opportunities */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Available Opportunities</CardTitle>
            <CardDescription>
              Browse and add opportunities to your tracker
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="hospice">Hospice</SelectItem>
                  <SelectItem value="emt">EMT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4">
              {filteredOpportunities.map((opp) => (
                <Card key={opp.id} className="bg-card/50 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{opp.name}</h3>
                          <Badge variant="outline" className="capitalize">
                            {opp.type}
                          </Badge>
                          <Badge className={getAcceptanceColor(opp.acceptance_likelihood)}>
                            {opp.acceptance_likelihood} acceptance
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{opp.location}</span>
                            {opp.distance && (
                              <span className="text-primary">({opp.distance} miles away)</span>
                            )}
                          </div>
                          {opp.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <a
                                href={`tel:${opp.phone}`}
                                className="text-primary hover:underline"
                              >
                                {opp.phone}
                              </a>
                            </div>
                          )}
                          {opp.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <a
                                href={`mailto:${opp.email}`}
                                className="text-primary hover:underline"
                              >
                                {opp.email}
                              </a>
                            </div>
                          )}
                          {opp.website && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              <a
                                href={opp.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Visit Website
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => addToTracker(opp.id)}
                        size="sm"
                        className="ml-4"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Tracker
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredOpportunities.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No opportunities found matching your criteria.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;