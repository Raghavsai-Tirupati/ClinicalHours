import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Hospital, Clock, MapPin, Users, Star, Building2, ClipboardCheck, MessageCircle, Heart, Target } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useInView } from "@/hooks/useInView";
import { useAuth } from "@/hooks/useAuth";
import HeroVideoCarousel from "@/components/HeroVideoCarousel";
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
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section - Full-screen immersive Squarespace style */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-foreground">
        {/* Video Background Carousel */}
        <HeroVideoCarousel />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-normal text-background leading-[1.05] tracking-tight animate-fade-in-up">
              Find Your<br />Clinical Future
            </h1>
            <p className="text-lg md:text-xl text-background/70 max-w-xl mx-auto leading-relaxed font-light animate-fade-in-up-delay-1">
              The crowdsourced platform helping pre-med students discover clinical opportunities.
            </p>
            
            <div className="pt-8 animate-fade-in-up-delay-2">
              <Link 
                to="/auth"
                className="inline-block text-sm uppercase tracking-widest px-12 py-5 bg-background text-foreground hover:bg-background/90 transition-colors"
              >
                Get Started
              </Link>
              <p className="mt-6 text-xs text-background/50 uppercase tracking-widest">
                Free forever. No credit card required.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-fade-in-up-delay-3">
          <div className="w-px h-20 bg-gradient-to-b from-background/40 to-transparent" />
        </div>
      </section>

      {/* Stats Section - Minimal, clean */}
      <section 
        ref={statsRef}
        className="py-32 bg-background"
      >
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-center items-center gap-20 md:gap-32">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center ${
                  statsInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-6xl md:text-7xl font-display font-normal text-foreground mb-3">
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
                <div className="text-xs text-foreground/50 uppercase tracking-[0.2em]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Clean cards on dark background */}
      <section ref={featuresRef} className="py-32 bg-foreground">
        <div className="container mx-auto px-6">
          <div className={`text-center max-w-2xl mx-auto mb-24 ${featuresInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-normal text-background mb-8">
              Built for Pre-Med Success
            </h2>
            <p className="text-background/60 text-lg leading-relaxed font-light">
              Everything you need to find, evaluate, and secure clinical opportunities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-background/10 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`p-12 bg-foreground hover:bg-foreground/90 transition-colors ${
                  featuresInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <feature.icon className="h-8 w-8 text-background/60 mb-8" strokeWidth={1} />
                <h3 className="text-xl font-normal text-background mb-4">{feature.title}</h3>
                <p className="text-background/50 leading-relaxed font-light">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={howItWorksRef} className="py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className={`text-center max-w-2xl mx-auto mb-24 ${howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-normal text-foreground mb-8">
              How It Works
            </h2>
            <p className="text-foreground/50 text-lg leading-relaxed font-light">
              Four steps to your clinical experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-5xl mx-auto">
            {howItWorksSteps.map((item, index) => (
              <div
                key={index}
                className={`text-center ${
                  howItWorksInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-20 h-20 mx-auto mb-8 border border-foreground/10 flex items-center justify-center">
                  <item.icon className="h-8 w-8 text-foreground/60" strokeWidth={1} />
                </div>
                <div className="text-xs text-foreground/40 uppercase tracking-[0.2em] mb-4">
                  Step {item.step}
                </div>
                <h3 className="font-display text-2xl font-normal text-foreground mb-4">
                  {item.title}
                </h3>
                <p className="text-foreground/50 leading-relaxed font-light">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section ref={ctaRef} className="py-40 bg-foreground">
        <div className="container mx-auto px-6">
          <div className={`max-w-3xl mx-auto text-center space-y-10 ${ctaInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="font-display text-4xl md:text-5xl lg:text-7xl font-normal text-background leading-tight">
              Ready to Start?
            </h2>
            <p className="text-xl text-background/60 max-w-xl mx-auto font-light">
              Join students discovering clinical opportunities through our platform.
            </p>
            <div className="pt-6">
              <Link 
                to="/auth"
                className="inline-block text-sm uppercase tracking-widest px-16 py-6 bg-background text-foreground hover:bg-background/90 transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section ref={storyRef} className="py-32 bg-background">
        <div className="container mx-auto px-6">
          <div className={`max-w-5xl mx-auto ${storyInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="order-2 md:order-1 space-y-8">
                <div className="text-xs text-foreground/40 uppercase tracking-[0.2em]">Our Story</div>
                <h2 className="font-display text-4xl md:text-5xl font-normal text-foreground">How It Started</h2>
                <p className="text-foreground/50 leading-relaxed font-light">
                  As college students—one pre-med, one engineering—we saw how frustrating it was to find real clinical experience. The pre-med among us spent weeks calling hospitals and clinics, only to learn that many didn't accept volunteers, had limited spots, or required certifications that were hard to get.
                </p>
                <p className="text-foreground/50 leading-relaxed font-light">
                  Together, we set out to build a centralized platform where students could share verified opportunities and insights to make the process smoother for everyone pursuing healthcare.
                </p>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="w-80 h-80 bg-foreground/5 flex items-center justify-center">
                  <img src={communityImage} alt="" className="w-56 opacity-60" />
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
