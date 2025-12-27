import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, Clock, MapPin, Users, Star, ArrowRight, Building2, ClipboardCheck, MessageCircle, Heart, Target } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useInView } from "@/hooks/useInView";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero-medical-purple.png";
import heroVideo from "@/assets/hero-video.mp4";
import communityImage from "@/assets/community-illustration.png";

const Home = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);
  
  const { ref: statsRef, isInView: statsInView } = useInView({ threshold: 0.2 });
  const { ref: storyRef, isInView: storyInView } = useInView({ threshold: 0.2 });
  const { ref: featuresRef, isInView: featuresInView } = useInView({ threshold: 0.1 });
  const { ref: howItWorksRef, isInView: howItWorksInView } = useInView({ threshold: 0.1 });
  const { ref: ctaRef, isInView: ctaInView } = useInView({ threshold: 0.2 });

  const howItWorksSteps = [
    {
      icon: MapPin,
      step: 1,
      title: "Discover",
      description: "Browse opportunities sorted by distance with acceptance likelihood.",
    },
    {
      icon: ClipboardCheck,
      step: 2,
      title: "Track",
      description: "Save and track your application progress in one dashboard.",
    },
    {
      icon: Star,
      step: 3,
      title: "Review",
      description: "Read real ratings from students who've been there.",
    },
    {
      icon: MessageCircle,
      step: 4,
      title: "Connect",
      description: "Ask questions and get answers from the community.",
    },
  ];

  const features = [
    {
      icon: Hospital,
      title: "Comprehensive Database",
      description: "Hospitals, clinics, hospice centers, EMT programs, and volunteering opportunities.",
    },
    {
      icon: Clock,
      title: "Detailed Requirements",
      description: "Hours required, contact info, and acceptance likelihood for each opportunity.",
    },
    {
      icon: MapPin,
      title: "Location-Based Search",
      description: "Find opportunities near you with interactive maps and powerful filters.",
    },
    {
      icon: Heart,
      title: "Student-Focused",
      description: "Built by students who understand the clinical experience hunt.",
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Learn from real experiences shared by other pre-med students.",
    },
    {
      icon: Target,
      title: "Transparent Process",
      description: "Clear information on requirements, hours, and acceptance rates.",
    },
  ];

  const stats = [
    { value: 4700, suffix: "+", label: "Opportunities", icon: Building2 },
    { value: 3000, suffix: "+", label: "Locations", icon: MapPin },
    { value: 100, suffix: "%", label: "Free", icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section - Squarespace-inspired centered layout */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={heroImage}
            className="w-full h-full object-cover"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-foreground/60" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className={`font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium text-background leading-[1.1] tracking-tight ${statsInView || true ? 'animate-fade-in-up' : ''}`}>
              Find Your Clinical Future
            </h1>
            <p className="text-lg md:text-xl text-background/80 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-1">
              The crowdsourced platform helping pre-med students discover clinical opportunities with real insights from students who've been there.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in-up-delay-2">
              <Button 
                asChild 
                size="lg" 
                className="text-base px-10 py-6 bg-background text-foreground hover:bg-background/90 rounded-sm"
              >
                <Link to="/map">
                  Explore Opportunities
                </Link>
              </Button>
              <Button 
                asChild 
                size="lg" 
                variant="outline" 
                className="text-base px-10 py-6 bg-transparent text-background border-background/40 hover:bg-background/10 hover:border-background rounded-sm"
              >
                <Link to="/auth">
                  Get Started
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up-delay-3">
          <div className="w-px h-16 bg-gradient-to-b from-background/60 to-transparent" />
        </div>
      </section>

      {/* Stats Section - Minimal, clean */}
      <section 
        ref={statsRef}
        className="py-24 bg-background"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-center items-center gap-16 md:gap-24">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center ${
                  statsInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-5xl md:text-6xl font-display font-medium text-foreground mb-2">
                  {statsInView ? (
                    <AnimatedCounter 
                      end={stat.value} 
                      suffix={stat.suffix}
                      duration={2000}
                    />
                  ) : (
                    `0${stat.suffix}`
                  )}
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Clean cards */}
      <section ref={featuresRef} className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className={`text-center max-w-2xl mx-auto mb-20 ${featuresInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium mb-6">
              Built for Pre-Med Success
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Everything you need to find, evaluate, and secure clinical opportunities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`p-8 bg-background rounded-sm border border-border/50 hover:border-primary/30 transition-colors ${
                  featuresInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <feature.icon className="h-8 w-8 text-primary mb-6" />
                <h3 className="text-xl font-medium mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - Horizontal steps */}
      <section ref={howItWorksRef} className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className={`text-center max-w-2xl mx-auto mb-20 ${howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium mb-6">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Four steps to your clinical experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {howItWorksSteps.map((item, index) => (
              <div
                key={index}
                className={`text-center ${
                  howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-widest mb-2">
                  Step {item.step}
                </div>
                <h3 className="font-display text-2xl font-medium mb-3">
                  {item.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Simple and bold */}
      <section ref={ctaRef} className="py-32 bg-foreground">
        <div className="container mx-auto px-4">
          <div className={`max-w-3xl mx-auto text-center space-y-8 ${ctaInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium text-background leading-tight">
              Ready to Start?
            </h2>
            <p className="text-xl text-background/70 max-w-xl mx-auto">
              Join students discovering clinical opportunities through our platform.
            </p>
            <div className="pt-4">
              <Button 
                asChild 
                size="lg" 
                className="text-base px-12 py-7 bg-background text-foreground hover:bg-background/90 rounded-sm"
              >
                <Link to="/auth">
                  Get Started Free
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section - Clean layout */}
      <section ref={storyRef} className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className={`max-w-5xl mx-auto ${storyInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 space-y-6">
                <div className="text-sm text-muted-foreground uppercase tracking-widest">Our Story</div>
                <h2 className="font-display text-4xl md:text-5xl font-medium">How It Started</h2>
                <p className="text-muted-foreground leading-relaxed">
                  As college students—one pre-med, one engineering—we saw how frustrating it was to find real clinical experience. The pre-med among us spent weeks calling hospitals and clinics, only to learn that many didn't accept volunteers, had limited spots, or required certifications that were hard to get.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Together, we set out to build a centralized platform where students could share verified opportunities and insights to make the process smoother for everyone pursuing healthcare.
                </p>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="w-64 h-64 bg-secondary/50 rounded-sm flex items-center justify-center">
                  <img src={communityImage} alt="" className="w-48 opacity-80" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
