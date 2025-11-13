import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OpportunitiesMap from "@/components/OpportunitiesMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MapPin, Clock, Phone, Mail, Star, AlertCircle, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  hours_required: string;
  acceptance_likelihood: string;
  description: string | null;
  requirements: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  avg_rating?: number;
  review_count?: number;
  distance?: number;
}

const Opportunities = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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
          console.error("Error getting location:", error);
          toast({
            title: "Location access denied",
            description: "Unable to sort by distance. Showing all opportunities.",
            variant: "destructive",
          });
        }
      );
    }
  }, [toast]);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const { data, error } = await supabase
          .from("opportunities_with_ratings")
          .select("*");

        if (error) throw error;

        let processedData: Opportunity[] = data.map((opp: any) => ({
          id: opp.id,
          name: opp.name,
          type: opp.type,
          location: opp.location,
          latitude: opp.latitude,
          longitude: opp.longitude,
          hours_required: opp.hours_required,
          acceptance_likelihood: opp.acceptance_likelihood,
          description: opp.description,
          requirements: opp.requirements || [],
          phone: opp.phone,
          email: opp.email,
          website: opp.website,
          avg_rating: opp.avg_rating,
          review_count: opp.review_count,
          distance: undefined,
        }));

        if (userLocation) {
          processedData = processedData.map((opp) => ({
            ...opp,
            distance: opp.latitude && opp.longitude
              ? calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  opp.latitude,
                  opp.longitude
                )
              : undefined,
          }));

          processedData.sort((a, b) => {
            if (a.distance === undefined) return 1;
            if (b.distance === undefined) return -1;
            return a.distance - b.distance;
          });
        }

        setOpportunities(processedData);
      } catch (error) {
        console.error("Error fetching opportunities:", error);
        toast({
          title: "Error",
          description: "Failed to load opportunities. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchOpportunities();
    }
  }, [user, userLocation, toast]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredOpportunities = opportunities.filter(
    (opp) =>
      (filterType === "all" || opp.type.toLowerCase() === filterType.toLowerCase()) &&
      (opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAcceptanceColor = (rate: string) => {
    switch (rate.toLowerCase()) {
      case "high":
        return "bg-success text-success-foreground";
      case "medium":
        return "bg-primary text-primary-foreground";
      case "low":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Clinical Opportunities Near You</h1>
            <p className="text-lg text-muted-foreground">
              Discover clinical opportunities sorted by distance from your location.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[200px]">
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

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading opportunities...</p>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No opportunities found</p>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="list" className="w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredOpportunities.length} opportunities
                  {userLocation && " sorted by distance"}
                </p>
                <TabsList>
                  <TabsTrigger value="list">
                    <Search className="h-4 w-4 mr-2" />
                    List View
                  </TabsTrigger>
                  <TabsTrigger value="map">
                    <Map className="h-4 w-4 mr-2" />
                    Map View
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="list" className="space-y-6">
                {filteredOpportunities.map((opportunity) => (
                <Card key={opportunity.id} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{opportunity.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-base">
                          <MapPin className="h-4 w-4" />
                          {opportunity.location}
                          {opportunity.distance && (
                            <span className="text-primary font-medium">
                              • {opportunity.distance.toFixed(1)} miles away
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{opportunity.type}</Badge>
                        <Badge className={getAcceptanceColor(opportunity.acceptance_likelihood)}>
                          {opportunity.acceptance_likelihood} Acceptance
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {opportunity.description && (
                      <p className="text-muted-foreground">{opportunity.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{opportunity.hours_required}</span>
                      </div>
                      {opportunity.avg_rating && (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-primary fill-primary" />
                          <span>
                            {opportunity.avg_rating.toFixed(1)} ({opportunity.review_count} reviews)
                          </span>
                        </div>
                      )}
                    </div>

                    {opportunity.requirements.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Requirements:</p>
                        <div className="flex flex-wrap gap-2">
                          {opportunity.requirements.map((req, idx) => (
                            <Badge key={idx} variant="secondary">
                              {req}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-2">
                      {opportunity.phone && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${opportunity.phone}`}>
                            <Phone className="mr-2 h-4 w-4" />
                            Call
                          </a>
                        </Button>
                      )}
                      {opportunity.email && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`mailto:${opportunity.email}`}>
                            <Mail className="mr-2 h-4 w-4" />
                            Email
                          </a>
                        </Button>
                      )}
                      {opportunity.website && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={opportunity.website} target="_blank" rel="noopener noreferrer">
                            Visit Website
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              </TabsContent>

              <TabsContent value="map">
                <OpportunitiesMap 
                  opportunities={filteredOpportunities} 
                  userLocation={userLocation}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Opportunities;
