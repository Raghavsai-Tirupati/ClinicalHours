interface TutorialProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function TutorialProgress({ currentStep, totalSteps }: TutorialProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <button
          key={index}
          className={`w-2 h-2 rounded-full transition-all duration-500 ${
            index === currentStep
              ? 'w-8 bg-white'
              : index < currentStep
              ? 'bg-white/60'
              : 'bg-white/20'
          }`}
          aria-label={`Go to step ${index + 1}`}
        />
      ))}
    </div>
  );
}
