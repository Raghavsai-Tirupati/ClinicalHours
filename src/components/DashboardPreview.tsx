import { useInView } from "@/hooks/useInView";
import DashboardVideoCarousel from "@/components/DashboardVideoCarousel";

const DashboardPreview = () => {
  const { ref: containerRef, isInView } = useInView({ threshold: 0.1 });

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

        {/* Dashboard preview carousel - Squarespace style rotating frames */}
        <DashboardVideoCarousel />

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
