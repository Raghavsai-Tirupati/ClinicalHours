import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MapPin, Building2, Heart } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useInView } from "@/hooks/useInView";
import { useAuth } from "@/hooks/useAuth";
import HeroVideoCarousel from "@/components/HeroVideoCarousel";
import HeroBrowserCarousel from "@/components/HeroBrowserCarousel";
import FeatureShowcase from "@/components/FeatureShowcase";
import FeatureShowcaseRail from "@/components/FeatureShowcaseRail";
import HowItWorksTimeline from "@/components/HowItWorksTimeline";

const Home = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);
  
  const { ref: statsRef, isInView: statsInView } = useInView({ threshold: 0.2 });
  const { ref: storyRef, isInView: storyInView } = useInView({ threshold: 0.2 });
  const { ref: ctaRef, isInView: ctaInView } = useInView({ threshold: 0.2 });

  const stats = [
    { value: 6000, suffix: "+", label: "Opportunities", icon: Building2 },
    { value: 3700, suffix: "+", label: "Cities", icon: MapPin },
    { value: 100, suffix: "%", label: "Free", icon: Heart },
  ];

  const handleHeroVideoChange = (index: number) => {
    setHeroVideoIndex(index);
  };

  return (
    <div className="min-h-screen">
      <Navigation />

      {/* Hero Section - Full-screen with fade to black at bottom */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
        {/* Video Background Carousel */}
        <HeroVideoCarousel onIndexChange={handleHeroVideoChange} />
        
        {/* Gradient overlay - barely noticeable fade only at very bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 from-0% via-transparent via-20% to-black to-[98%] z-[5]"></div>
        
        {/* Main hero content */}
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white leading-[1.1] sm:leading-[1.05] tracking-wide animate-fade-in-up drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)] font-heading uppercase">
              Find Your<br />Clinical Future
            </h1>
            
            <div className="pt-2 sm:pt-4 animate-fade-in-up-delay-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0">
                <Link 
                  to="/auth"
                  className="group inline-flex items-center justify-center text-sm uppercase tracking-widest px-8 sm:px-12 py-4 sm:py-5 bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] relative overflow-hidden min-h-[52px]"
                >
                  <span className="relative z-10">Get Started</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                </Link>
                <Link 
                  to="/map"
                  className="group inline-flex items-center justify-center text-sm uppercase tracking-widest px-8 sm:px-12 py-4 sm:py-5 bg-transparent border-2 border-white text-white hover:bg-white/10 transition-all duration-300 hover:scale-105 relative overflow-hidden min-h-[52px]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    View Map
                  </span>
                </Link>
              </div>
              <p className="mt-4 sm:mt-6 text-xs text-white/50 uppercase tracking-widest animate-pulse">
                Free forever. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Browser Carousel Section - Seamless black background */}
      <section className="relative py-16 sm:py-20 md:py-24 bg-black overflow-hidden">
        <div className="container mx-auto px-4">
          <HeroBrowserCarousel activeIndex={heroVideoIndex} />
        </div>
      </section>

      {/* Stats Section - Below the carousel */}
      <section 
        ref={statsRef}
        className="py-16 sm:py-24 md:py-32 bg-black relative overflow-hidden"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-3 md:flex md:flex-row justify-center items-center gap-4 sm:gap-12 md:gap-32">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center group cursor-default ${
                  statsInView ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="relative inline-block mb-2 sm:mb-3">
                  <div className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-white relative z-10 group-hover:scale-110 transition-transform duration-300" style={{ fontWeight: 400, fontFamily: '"Times New Roman", Times, serif' }}>
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
                  <div className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-30 bg-white transition-opacity duration-300"></div>
                </div>
                <div className="flex items-center justify-center gap-1 sm:gap-2 mb-2">
                  <stat.icon className="h-3 w-3 sm:h-4 sm:w-4 text-white/40 group-hover:text-white/70 transition-colors duration-300" />
                  <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-[0.1em] sm:tracking-[0.2em] group-hover:text-white/80 transition-colors duration-300" style={{ fontWeight: 400 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Feature Showcase - Interactive Squarespace-style section */}
      <FeatureShowcase />

      {/* Features Section - Horizontal scrolling rail */}
      <FeatureShowcaseRail />

      {/* How It Works Section - Scroll-reveal timeline */}
      <HowItWorksTimeline />

      {/* CTA Section */}
      <section ref={ctaRef} className="py-20 sm:py-28 md:py-40 bg-black relative overflow-hidden">
        {/* Gradient overlay for emphasis */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none"></div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className={`max-w-3xl mx-auto text-center space-y-6 sm:space-y-10 ${ctaInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-light text-white leading-tight tracking-wide drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)] font-heading uppercase">
              Ready to Start?
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white/60 max-w-xl mx-auto font-normal drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] px-4 sm:px-0">
              Join students discovering clinical opportunities through our platform.
            </p>
            <div className="pt-4 sm:pt-6 px-4 sm:px-0">
              <Link 
                to="/auth"
                className="group inline-flex items-center justify-center w-full sm:w-auto text-sm uppercase tracking-widest px-8 sm:px-16 py-5 sm:py-6 bg-white text-black hover:bg-white/90 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] relative overflow-hidden min-h-[56px]"
              >
                <span className="relative z-10">Get Started Free</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section ref={storyRef} className="py-32 bg-black" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <div className="container mx-auto px-6 relative z-10">
          <div className={`max-w-3xl mx-auto text-center ${storyInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="space-y-8">
              <div className="text-xs text-white/40 uppercase tracking-[0.2em]" style={{ fontWeight: 400 }}>Our Story</div>
              <h2 className="text-4xl md:text-5xl text-white" style={{ fontWeight: 400 }}>How It Started</h2>
              <p className="text-white/50 leading-relaxed" style={{ fontWeight: 400 }}>
                Clinical Hours started with a simple problem.
              </p>
              <p className="text-white/50 leading-relaxed" style={{ fontWeight: 400 }}>
                As a premed student, finding clinical experience was harder than it needed to be. Opportunities were scattered across hospital websites, outdated lists, and word of mouth, with no clear way to know what was real or accessible.
              </p>
              <p className="text-white/50 leading-relaxed" style={{ fontWeight: 400 }}>
                At the same time, an engineering student saw a system that lacked structure. The information existed, but it was disorganized, inefficient, and difficult to navigate.
              </p>
              <p className="text-white/50 leading-relaxed" style={{ fontWeight: 400 }}>
                We realized this was not just a personal frustration. It was a shared problem for students everywhere. So we built Clinical Hours to bring real clinical opportunities into one clear, reliable place.
              </p>
              <p className="text-white/50 leading-relaxed italic" style={{ fontWeight: 400 }}>
                Built by students who have gone through the process, for students who are still navigating it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
