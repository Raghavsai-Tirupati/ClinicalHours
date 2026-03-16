import { useState } from 'react';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  'hsl(210, 70%, 50%)',  // blue
  'hsl(340, 65%, 47%)',  // rose
  'hsl(160, 55%, 40%)',  // teal
  'hsl(270, 55%, 50%)',  // purple
  'hsl(25, 75%, 47%)',   // orange
  'hsl(190, 60%, 42%)',  // cyan
  'hsl(350, 60%, 52%)',  // red
  'hsl(140, 50%, 38%)',  // green
  'hsl(45, 70%, 45%)',   // amber
  'hsl(230, 55%, 52%)',  // indigo
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

interface HospitalLogoProps {
  logoUrl: string | null;
  hospitalName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
} as const;

const textSizeMap = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

export default function HospitalLogo({
  logoUrl,
  hospitalName,
  size = 'md',
  className,
}: HospitalLogoProps) {
  const [imgError, setImgError] = useState(false);
  const px = sizeMap[size];
  const letter = (hospitalName || '?')[0].toUpperCase();
  const color = AVATAR_COLORS[hashName(hospitalName) % AVATAR_COLORS.length];

  const showAvatar = !logoUrl || imgError;

  return (
    <div
      className={cn(
        'relative shrink-0 rounded-lg overflow-hidden flex items-center justify-center',
        showAvatar ? '' : 'border border-border bg-muted/30',
        className,
      )}
      style={{ width: px, height: px }}
    >
      {!showAvatar ? (
        <img
          src={logoUrl!}
          alt={`${hospitalName} logo`}
          className="w-full h-full object-contain p-1"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex items-center justify-center font-semibold text-white select-none rounded-lg',
            textSizeMap[size],
          )}
          style={{ backgroundColor: color }}
          aria-label={`${hospitalName} avatar`}
        >
          {letter}
        </div>
      )}
    </div>
  );
}
