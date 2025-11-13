import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, Clock, Star, Users, Search, MapPin } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Home = () => {
  const features = [
    {
      icon: Hospital,
      title: "Comprehensive Database",
      description: "Access hospitals, clinics, hospice centers, EMT programs, and volunteering opportunities.",
    },
    {
      icon: Star,
      title: "Community Reviews",
      description: "Read honest reviews and ratings from fellow pre-med students about their experiences.",
    },
    {
      icon: Clock,
      title: "Detailed Requirements",
      description: "View hours required, contact information, and acceptance likelihood for each opportunity.",
    },
    {
      icon: MapPin,
      title: "Location-Based Search",
      description: "Find clinical opportunities near you with our interactive map and search features.",
    },
  ];

  const stats = [
    { value: "500+", label: "Opportunities" },
    { value: "1,000+", label: "Student Reviews" },
    { value: "50+", label: "Cities" },
    { value: "95%", label: "Success Rate" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-[hsl(var(--hero-gradient-end))] opacity-5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              Find Your Perfect <span className="text-primary">Clinical Experience</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              The crowdsourced platform helping pre-med students discover and secure clinical opportunities. 
              Get insights from real students about hospitals, clinics, and volunteering programs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button asChild size="lg" className="text-base">
                <Link to="/opportunities">
                  <Search className="mr-2 h-5 w-5" />
                  Explore Opportunities
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base">
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose ClinicalHours?</h2>
            <p className="text-muted-foreground">
              Everything you need to find, evaluate, and secure clinical opportunities in one place.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border hover:border-primary transition-colors">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-4" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">Ready to Start Your Clinical Journey?</h2>
            <p className="text-lg opacity-90">
              Join hundreds of pre-med students who have found their clinical opportunities through our platform.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-6">
              <Link to="/opportunities">Get Started Now</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
