import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, Clock, Search, MapPin, Users, Star, ArrowRight, Building2, TrendingUp, ClipboardCheck, MessageCircle, Heart, Target } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useInView } from "@/hooks/useInView";
import heroImage from "@/assets/hero-medical-purple.png";
import heroVideo from "@/assets/hero-video.mp4";
import communityImage from "@/assets/community-illustration.png";

const Home = () => {
  const { ref: statsRef, isInView: statsInView } = useInView({ threshold: 0.2 });
  const { ref: storyRef, isInView: storyInView } = useInView({ threshold: 0.2 });
  const { ref: featuresRef, isInView: featuresInView } = useInView({ threshold: 0.1 });
  const { ref: howItWorksRef, isInView: howItWorksInView } = useInView({ threshold: 0.1 });
  const { ref: ctaRef, isInView: ctaInView } = useInView({ threshold: 0.2 });

  const howItWorksSteps = [
    {
      icon: Search,
      step: 1,
      title: "Discover Opportunities",
      description: "Browse clinical opportunities sorted by distance. Filter by type and see acceptance likelihood at a glance.",
    },
    {
      icon: ClipboardCheck,
      step: 2,
      title: "Track Your Progress",
      description: "Save opportunities to your personal dashboard. Track every stage: contacted, applied, heard back, interview.",
    },
    {
      icon: Star,
      step: 3,
      title: "Read Real Reviews",
      description: "See ratings from real students on staff friendliness, learning value, and overall experience.",
    },
    {
      icon: MessageCircle,
      step: 4,
      title: "Ask the Community",
      description: "Post questions about any opportunity and get answers from students who've volunteered there.",
    },
  ];

  const features = [
    {
      icon: Hospital,
      title: "Comprehensive Database",
      description: "Access hospitals, clinics, hospice centers, EMT programs, and volunteering opportunities all in one place.",
    },
    {
      icon: Clock,
      title: "Detailed Requirements",
      description: "View hours required, contact information, and acceptance likelihood for each opportunity.",
    },
    {
      icon: MapPin,
      title: "Location-Based Search",
      description: "Find clinical opportunities near you with our interactive map and powerful search features.",
    },
    {
      icon: Heart,
      title: "Student-Focused",
      description: "Built by students, for students. We understand the challenges of finding clinical opportunities.",
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Powered by honest reviews and experiences from real pre-med students nationwide.",
    },
    {
      icon: Target,
      title: "Transparent Process",
      description: "Clear information about requirements, hours, and acceptance rates—no surprises.",
    },
  ];

  const stats = [
    { value: 500, suffix: "+", label: "Clinical Opportunities", icon: Building2 },
    { value: 50, suffix: "+", label: "Cities Covered", icon: MapPin },
    { value: 95, suffix: "%", label: "Student Success Rate", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section with Video Background */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={heroImage}
            className="w-full h-full object-cover scale-110 origin-top-left"
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          {/* Gradient Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/30" />
        </div>

        {/* Floating Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-[15%] w-64 h-64 rounded-full bg-primary/10 blur-3xl animate-float" />
          <div className="absolute bottom-32 right-[25%] w-48 h-48 rounded-full bg-primary/15 blur-2xl animate-float-delay-1" />
          <div className="absolute top-1/3 right-[10%] w-32 h-32 rounded-full bg-primary/20 blur-xl animate-float-delay-2" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl space-y-8">
            <div className="space-y-6">
              <span className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium backdrop-blur-sm border border-primary/20 animate-fade-in-up">
                🩺 The #1 Platform for Pre-Med Students
              </span>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight animate-fade-in-up-delay-1">
                Find Your Perfect{" "}
                <span className="text-primary relative">
                  Clinical Experience
                  <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 12" preserveAspectRatio="none">
                    <path d="M0,6 Q50,0 100,6 T200,6" stroke="currentColor" strokeWidth="4" fill="none" className="animate-[fade-in_1s_ease-out_0.5s_forwards] opacity-0" />
                  </svg>
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in-up-delay-2">
                The crowdsourced platform helping pre-med students discover and secure 
                clinical opportunities. Get real insights from students who've been there.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up-delay-3">
              <Button asChild size="lg" className="text-base px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-pulse-glow">
                <Link to="/opportunities">
                  <Search className="mr-2 h-5 w-5" />
                  Explore Opportunities
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-base px-8 py-6 bg-background/50 backdrop-blur-sm hover:bg-background/80 border-border/50 hover:scale-105 transition-all">
                <Link to="/auth">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-6 pt-4 animate-fade-in-up-delay-3">
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center backdrop-blur-sm">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/30 border-2 border-background flex items-center justify-center backdrop-blur-sm">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/40 border-2 border-background flex items-center justify-center text-primary font-semibold text-sm backdrop-blur-sm">
                  +
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">1,000+</span> pre-med students 
                have found opportunities
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section 
        ref={statsRef}
        className="py-20 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5 border-y border-border relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center group p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover-lift ${
                  statsInView ? `animate-stagger-${index + 1}` : 'opacity-0'
                }`}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6 group-hover:bg-primary/20 transition-colors group-hover:scale-110 transform duration-300">
                  <stat.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-3">
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
                <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section ref={storyRef} className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full bg-gradient-radial from-primary/5 to-transparent blur-3xl -translate-y-1/2" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className={`max-w-5xl mx-auto ${storyInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/3 p-8 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  <img src={communityImage} alt="" className="w-full max-w-[200px] rounded-lg opacity-90" />
                </div>
                <CardContent className="md:w-2/3 p-8 space-y-6">
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm uppercase tracking-wider mb-4">
                      Our Story
                    </span>
                    <h2 className="text-3xl md:text-4xl font-bold">How It Started</h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    As pre-med students ourselves, we experienced firsthand the frustration of trying to find clinical
                    opportunities. We spent weeks calling different facilities, only to discover that many didn't accept
                    volunteers, had extremely limited spots, or required certifications we didn't have.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    We realized that there had to be a better way. By creating a centralized platform where students could
                    share their experiences and insights, we could help future pre-meds navigate this process more
                    efficiently. Today, ClinicalHours serves hundreds of students across the country.
                  </p>
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-24 relative bg-gradient-to-b from-background via-primary/5 to-background">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-primary/5 to-transparent blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className={`text-center max-w-2xl mx-auto mb-16 ${featuresInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm uppercase tracking-wider mb-4">
              Why ClinicalHours
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-6">Built for Pre-Med Success</h2>
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed">
              Everything you need to find, evaluate, and secure clinical opportunities in one place.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`group border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/50 hover-lift ${
                  featuresInView ? `animate-stagger-${(index % 3) + 1}` : 'opacity-0'
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300 group-hover:scale-110">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl group-hover:text-primary transition-colors">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="py-24 bg-gradient-to-b from-primary/5 via-background to-primary/5 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-float" />
          <div className="absolute bottom-20 right-[10%] w-64 h-64 rounded-full bg-primary/10 blur-3xl animate-float-delay-2" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className={`text-center max-w-2xl mx-auto mb-16 ${howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm uppercase tracking-wider mb-4">
              How It Works
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-3 mb-6">
              From Discovery to Acceptance
            </h2>
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed">
              Four simple steps to find and secure your perfect clinical experience.
            </p>
          </div>

          {/* Steps Container */}
          <div className="relative max-w-6xl mx-auto">
            {/* Connecting Line - Desktop */}
            <div className="hidden md:block absolute top-16 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20">
              <div 
                className={`h-full bg-gradient-to-r from-primary via-primary to-primary transition-all duration-1000 ease-out ${
                  howItWorksInView ? 'w-full' : 'w-0'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
              {howItWorksSteps.map((item, index) => (
                <div
                  key={index}
                  className={`relative flex flex-col items-center text-center group ${
                    howItWorksInView ? `animate-stagger-${index + 1}` : 'opacity-0'
                  }`}
                >
                  {/* Step Number Badge */}
                  <div className="relative mb-6">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-1 group-hover:from-primary/30 group-hover:via-primary/20 transition-all duration-300">
                      <div className="w-full h-full rounded-full bg-card border border-border/50 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                        <item.icon className="h-12 w-12 text-primary group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    </div>
                    {/* Step Number */}
                    <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-lg shadow-lg group-hover:scale-110 transition-transform">
                      {item.step}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-[250px]">
                    {item.description}
                  </p>

                  {/* Connecting Arrow - Mobile */}
                  {index < howItWorksSteps.length - 1 && (
                    <div className="md:hidden mt-6 text-primary/40">
                      <ArrowRight className="h-8 w-8 rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(280,65%,55%)] animate-gradient" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-[10%] w-20 h-20 rounded-full border-2 border-primary-foreground/20 animate-float" />
          <div className="absolute bottom-20 right-[15%] w-32 h-32 rounded-full border-2 border-primary-foreground/10 animate-float-delay-1" />
          <div className="absolute top-1/2 left-[5%] w-16 h-16 rounded-full bg-primary-foreground/5 animate-float-delay-2" />
          <div className="absolute top-20 right-[8%] w-24 h-24 rounded-full bg-primary-foreground/5 animate-float-slow" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className={`max-w-3xl mx-auto text-center space-y-8 ${ctaInView ? 'animate-scale-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight">
              Ready to Start Your Clinical Journey?
            </h2>
            <p className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed max-w-2xl mx-auto">
              Join thousands of pre-med students who have found their clinical opportunities through our platform.
            </p>
            <div className="pt-4">
              <Button 
                asChild 
                size="lg" 
                variant="secondary" 
                className="text-base md:text-lg px-10 py-7 shadow-xl hover:shadow-2xl transition-all hover:scale-105 animate-pulse-glow"
              >
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
