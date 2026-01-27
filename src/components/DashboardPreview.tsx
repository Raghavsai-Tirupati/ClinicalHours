import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";

const DashboardPreview = () => {
  const { ref: containerRef, isInView } = useInView({ threshold: 0.1 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current && isInView) {
      videoRef.current.play().catch(() => {});
    }
  }, [isInView]);

  return (
    <section 
      ref={containerRef}
      className="relative py-24 sm:py-32 md:py-40 bg-black overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950/50 to-zinc-900/30 pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Section header */}
        <div 
          className={`text-center mb-12 sm:mb-16 md:mb-20 transition-all duration-700 ${
            isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-xs text-white/40 uppercase tracking-[0.3em] mb-4">
            Dashboard
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white tracking-wide font-heading uppercase">
            Track Your<br className="sm:hidden" /> Progress
          </h2>
        </div>

        {/* Dashboard preview container - Squarespace style half-visible */}
        <div 
          className={`relative max-w-5xl mx-auto transition-all duration-1000 delay-200 ${
            isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
          }`}
        >
          {/* Glow effect behind the preview */}
          <div className="absolute -inset-4 bg-gradient-to-t from-purple-500/20 via-purple-500/5 to-transparent blur-3xl opacity-50 pointer-events-none" />
          
          {/* Browser-style frame */}
          <div className="relative rounded-t-xl sm:rounded-t-2xl overflow-hidden border border-white/10 border-b-0 bg-zinc-900/90 backdrop-blur-sm shadow-2xl shadow-black/50">
            {/* Browser header bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/80 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 mx-4">
                <div className="max-w-sm mx-auto bg-zinc-700/50 rounded-md px-3 py-1.5 flex items-center justify-center">
                  <span className="text-xs text-white/40 truncate">clinicalhours.lovable.app/dashboard</span>
                </div>
              </div>
              <div className="w-16" /> {/* Spacer for symmetry */}
            </div>
            
            {/* Video/Image preview - cut off at bottom to show only top portion */}
            <div className="relative aspect-[16/9] overflow-hidden">
              <video
                ref={videoRef}
                src="/screenshots/dashboard-preview.mp4"
                muted
                loop
                playsInline
                poster="/screenshots/dashboard.png"
                onLoadedData={() => setIsLoaded(true)}
                className={`w-full h-full object-cover object-top transition-opacity duration-500 ${
                  isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {/* Fallback to static image if video doesn't load */}
              <img 
                src="/screenshots/dashboard.png" 
                alt="Dashboard Preview"
                className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500 ${
                  isLoaded ? 'opacity-0' : 'opacity-100'
                }`}
              />
              
              {/* Bottom fade to black - creates the "cut off" effect */}
              <div className="absolute bottom-0 left-0 right-0 h-32 sm:h-48 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
            </div>
          </div>
          
          {/* Reflection/shadow effect at bottom */}
          <div className="h-8 sm:h-12 bg-gradient-to-b from-zinc-900/50 to-transparent rounded-b-xl" />
        </div>

        {/* Feature pills below the preview */}
        <div 
          className={`flex flex-wrap justify-center gap-3 sm:gap-4 mt-8 sm:mt-12 transition-all duration-700 delay-500 ${
            isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {['Track Hours', 'Save Opportunities', 'Set Reminders', 'Log Moments'].map((feature, index) => (
            <span 
              key={feature}
              className="px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm text-white/60 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:text-white/80 transition-all duration-300 cursor-default"
              style={{ animationDelay: `${600 + index * 100}ms` }}
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DashboardPreview;
