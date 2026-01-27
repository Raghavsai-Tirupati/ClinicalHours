import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import TutorialStep from './TutorialStep';
import TutorialProgress from './TutorialProgress';
import {
  LayoutDashboard,
  Search,
  Map,
  MessageCircle,
  User,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  Rocket,
} from 'lucide-react';

interface OnboardingTutorialProps {
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    icon: LayoutDashboard,
    title: 'Your Command Center',
    subtitle: 'Dashboard',
    description:
      'Track your clinical journey in one place. See your saved opportunities, monitor application progress, and log your hours as you build experience.',
    features: ['Application Tracker', 'Hour Logging', 'Progress Stats'],
  },
  {
    icon: Search,
    title: 'Discover Opportunities',
    subtitle: 'Opportunities',
    description:
      'Browse thousands of clinical opportunities sorted by distance. Filter by type, search by name, and add promising positions to your tracker with one click.',
    features: ['Smart Search', 'Type Filters', 'Distance Sorting'],
  },
  {
    icon: Map,
    title: 'Explore Nearby',
    subtitle: 'Map View',
    description:
      'Visualize opportunities on an interactive map. Drop a custom pin to search from any location, adjust your radius, and discover hidden gems in your area.',
    features: ['Interactive Map', 'Custom Pin', 'Radius Filter'],
  },
  {
    icon: MessageCircle,
    title: "We're Here to Help",
    subtitle: 'Contact',
    description:
      'Found a broken link? Have a question? Our team responds within 24-48 hours. Your feedback helps us improve the platform for everyone.',
    features: ['Quick Support', 'Report Issues', 'Suggestions'],
  },
  {
    icon: User,
    title: 'Complete Your Profile',
    subtitle: 'Profile',
    description:
      'A complete profile unlocks reviews and Q&A features. Your changes save automatically — no submit button needed. Add your university, major, and career goals.',
    features: ['Auto-Save', 'Resume Upload', 'Review Access'],
  },
];

// Total steps including the final "launch" step
const TOTAL_VISUAL_STEPS = TUTORIAL_STEPS.length + 1;

export default function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLastContentStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isLaunchStep = currentStep === TUTORIAL_STEPS.length;

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Lock body scroll when tutorial is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle scroll-based navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isScrollingUp) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const stepHeight = container.clientHeight;
      const newStep = Math.round(scrollTop / stepHeight);
      if (newStep !== currentStep && newStep >= 0 && newStep < TOTAL_VISUAL_STEPS) {
        setCurrentStep(newStep);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentStep, isScrollingUp]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isScrollingUp) return;
      
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextStep();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevStep();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isScrollingUp]);

  const scrollToStep = useCallback((step: number) => {
    const container = containerRef.current;
    if (!container) return;

    const stepHeight = container.clientHeight;
    container.scrollTo({
      top: step * stepHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [prefersReducedMotion]);

  const goToNextStep = useCallback(() => {
    if (currentStep < TOTAL_VISUAL_STEPS - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      scrollToStep(nextStep);
    }
  }, [currentStep, scrollToStep]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      scrollToStep(prevStep);
    }
  }, [currentStep, scrollToStep]);

  const markComplete = async () => {
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ onboarding_complete: true } as any)
          .eq('id', user.id);
      } catch (error) {
        console.error('Failed to mark onboarding complete:', error);
      }
    }
  };

  const handleLaunch = async () => {
    setIsScrollingUp(true);
    await markComplete();
    
    const container = containerRef.current;
    if (container) {
      // Scroll all the way up with a smooth animation
      container.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
    
    // Wait for scroll animation, then fade out and complete
    setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        onComplete();
      }, 500);
    }, prefersReducedMotion ? 100 : 1200);
  };

  const handleSkip = async () => {
    setIsClosing(true);
    await markComplete();
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  const transition = prefersReducedMotion ? 'none' : 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black"
      style={{
        opacity: isClosing ? 0 : 1,
        transition,
      }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-white/[0.02] pointer-events-none" />

      {/* Skip button - hide on launch step */}
      {!isLaunchStep && !isScrollingUp && (
        <button
          onClick={handleSkip}
          className="absolute top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Skip
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Progress indicator - fixed at bottom, hide on launch step */}
      {!isLaunchStep && !isScrollingUp && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <TutorialProgress currentStep={currentStep} totalSteps={TUTORIAL_STEPS.length} />
        </div>
      )}

      {/* Navigation buttons - hide on launch step */}
      {!isLaunchStep && !isScrollingUp && (
        <div className="absolute bottom-8 right-8 z-50 flex items-center gap-3">
          {isLastContentStep ? (
            <Button
              onClick={goToNextStep}
              className="bg-white text-black hover:bg-white/90 px-8 py-6 text-sm uppercase tracking-widest"
            >
              Continue
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={goToNextStep}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 px-6 py-6 text-sm uppercase tracking-widest"
            >
              Next
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {/* Scroll hint - only on first step */}
      {currentStep === 0 && !isScrollingUp && (
        <div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 text-white/30"
          style={{
            animation: prefersReducedMotion ? 'none' : 'pulse 2s ease-in-out infinite',
          }}
        >
          <span className="text-xs uppercase tracking-widest">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </div>
      )}

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory"
        style={{
          scrollSnapType: prefersReducedMotion || isScrollingUp ? 'none' : 'y mandatory',
        }}
      >
        {TUTORIAL_STEPS.map((step, index) => (
          <div
            key={index}
            className="h-screen w-full snap-start snap-always flex items-center justify-center"
          >
            <TutorialStep
              icon={step.icon}
              title={step.title}
              subtitle={step.subtitle}
              description={step.description}
              features={step.features}
              isActive={currentStep === index}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        ))}
        
        {/* Final Launch Step */}
        <div className="h-screen w-full snap-start snap-always flex items-center justify-center">
          <div className="text-center px-6 max-w-lg">
            <div 
              className="mb-8 mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
              style={{
                opacity: isLaunchStep && !isScrollingUp ? 1 : 0,
                transform: isLaunchStep && !isScrollingUp ? 'scale(1)' : 'scale(0.8)',
                transition: prefersReducedMotion ? 'none' : 'all 0.5s ease-out',
              }}
            >
              <Rocket className="w-12 h-12 text-primary" />
            </div>
            
            <h2 
              className="text-4xl md:text-5xl font-bold text-white mb-4"
              style={{
                opacity: isLaunchStep && !isScrollingUp ? 1 : 0,
                transform: isLaunchStep && !isScrollingUp ? 'translateY(0)' : 'translateY(20px)',
                transition: prefersReducedMotion ? 'none' : 'all 0.5s ease-out 0.1s',
              }}
            >
              Ready to Launch?
            </h2>
            
            <p 
              className="text-lg text-white/60 mb-10"
              style={{
                opacity: isLaunchStep && !isScrollingUp ? 1 : 0,
                transform: isLaunchStep && !isScrollingUp ? 'translateY(0)' : 'translateY(20px)',
                transition: prefersReducedMotion ? 'none' : 'all 0.5s ease-out 0.2s',
              }}
            >
              Your clinical journey awaits. Hit the button to blast off into your dashboard.
            </p>
            
            <Button
              onClick={handleLaunch}
              disabled={isScrollingUp}
              className="bg-white text-black hover:bg-white/90 px-10 py-7 text-base uppercase tracking-widest group"
              style={{
                opacity: isLaunchStep && !isScrollingUp ? 1 : 0,
                transform: isLaunchStep && !isScrollingUp ? 'translateY(0)' : 'translateY(20px)',
                transition: prefersReducedMotion ? 'none' : 'all 0.5s ease-out 0.3s',
              }}
            >
              {isScrollingUp ? (
                <>
                  Launching...
                  <ArrowUp className="w-5 h-5 ml-2 animate-bounce" />
                </>
              ) : (
                <>
                  Launch Dashboard
                  <ChevronUp className="w-5 h-5 ml-2 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </Button>
            
            {/* Scroll up hint */}
            {isLaunchStep && !isScrollingUp && (
              <div 
                className="mt-12 flex flex-col items-center gap-2 text-white/20"
                style={{
                  animation: prefersReducedMotion ? 'none' : 'pulse 2s ease-in-out infinite',
                }}
              >
                <ChevronUp className="w-5 h-5" />
                <span className="text-xs uppercase tracking-widest">or scroll up to go back</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
