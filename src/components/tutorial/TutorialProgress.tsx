interface TutorialProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function TutorialProgress({ currentStep, totalSteps }: TutorialProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`h-2 rounded-full transition-all duration-300 ${
            index === currentStep
              ? 'bg-white w-6'
              : index < currentStep
              ? 'bg-white/60 w-2'
              : 'bg-white/30 w-2'
          }`}
        />
      ))}
    </div>
  );
}
