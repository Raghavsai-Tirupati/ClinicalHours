import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Clock, Phone, Mail, Star, TrendingUp } from "lucide-react";

interface Opportunity {
  id: number;
  name: string;
  type: string;
  location: string;
  hours: string;
  acceptanceRate: string;
  rating: number;
  reviewCount: number;
  contact: { phone: string; email: string };
  requirements: string[];
}

const Opportunities = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const opportunities: Opportunity[] = [
    {
      id: 1,
      name: "City General Hospital",
      type: "Hospital",
      location: "Downtown, CA",
      hours: "100+ hours/year",
      acceptanceRate: "High",
      rating: 4.5,
      reviewCount: 24,
      contact: { phone: "(555) 123-4567", email: "volunteer@citygeneral.org" },
      requirements: ["Background check", "TB test", "Orientation"],
    },
    {
      id: 2,
      name: "Community Health Clinic",
      type: "Clinic",
      location: "Westside, CA",
      hours: "50-100 hours/year",
      acceptanceRate: "Medium",
      rating: 4.2,
      reviewCount: 18,
      contact: { phone: "(555) 234-5678", email: "info@communityclinic.org" },
      requirements: ["HIPAA training", "CPR certification"],
    },
    {
      id: 3,
      name: "Sunrise Hospice Care",
      type: "Hospice",
      location: "Northville, CA",
      hours: "40+ hours/year",
      acceptanceRate: "High",
      rating: 4.8,
      reviewCount: 31,
      contact: { phone: "(555) 345-6789", email: "volunteers@sunrisehospice.org" },
      requirements: ["Emotional intelligence training", "Background check"],
    },
    {
      id: 4,
      name: "Local EMT Program",
      type: "EMT",
      location: "Eastside, CA",
      hours: "150+ hours/program",
      acceptanceRate: "Low",
      rating: 4.6,
      reviewCount: 42,
      contact: { phone: "(555) 456-7890", email: "emt@localfiredept.org" },
      requirements: ["EMT certification course", "Physical fitness test"],
    },
  ];

  const filteredOpportunities = opportunities.filter(
    (opp) =>
      (filterType === "all" || opp.type.toLowerCase() === filterType.toLowerCase()) &&
      (opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAcceptanceColor = (rate: string) => {
    switch (rate) {
      case "High":
        return "bg-success text-success-foreground";
      case "Medium":
        return "bg-primary text-primary-foreground";
      case "Low":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Clinical Opportunities</h1>
            <p className="text-lg text-muted-foreground">
              Discover and compare clinical opportunities from hospitals, clinics, hospice care, and EMT programs.
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

          {/* Results Count */}
          <div className="mb-6 text-sm text-muted-foreground">
            Showing {filteredOpportunities.length} opportunities
          </div>

          {/* Opportunities List */}
          <div className="space-y-6">
            {filteredOpportunities.map((opportunity) => (
              <Card key={opportunity.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-2xl">{opportunity.name}</CardTitle>
                        <Badge variant="secondary">{opportunity.type}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {opportunity.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {opportunity.hours}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-primary text-primary" />
                      <span className="font-semibold">{opportunity.rating}</span>
                      <span className="text-sm text-muted-foreground">({opportunity.reviewCount} reviews)</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Acceptance Rate */}
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Acceptance Likelihood:</span>
                    <Badge className={getAcceptanceColor(opportunity.acceptanceRate)}>
                      {opportunity.acceptanceRate}
                    </Badge>
                  </div>

                  {/* Requirements */}
                  <div>
                    <p className="text-sm font-medium mb-2">Requirements:</p>
                    <div className="flex flex-wrap gap-2">
                      {opportunity.requirements.map((req, index) => (
                        <Badge key={index} variant="outline">
                          {req}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-primary" />
                      <a href={`tel:${opportunity.contact.phone}`} className="hover:text-primary transition-colors">
                        {opportunity.contact.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-primary" />
                      <a
                        href={`mailto:${opportunity.contact.email}`}
                        className="hover:text-primary transition-colors"
                      >
                        {opportunity.contact.email}
                      </a>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <Button className="w-full sm:w-auto">View Details & Reviews</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Opportunities;
