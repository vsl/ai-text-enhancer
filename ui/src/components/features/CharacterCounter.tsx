'use client';

import { useAuth } from '@/context/AuthContext';

/**
 * Props for the CharacterCounter component
 */
interface CharacterCounterProps {
  /** Current number of characters in the text field */
  currentLength: number;
  /** Maximum allowed characters for the current tier */
  maxLength: number;
  /** Label for the counter (e.g., "Text" or "Context") */
  label: string;
}

export function CharacterCounter({
  currentLength,
  maxLength,
  label,
}: CharacterCounterProps) {
  const { profile } = useAuth();
  const tierName = profile?.tier || 'free';
  const percentage = (currentLength / maxLength) * 100;

  const getColorClass = () => {
    if (percentage > 90) return 'text-red-600 dark:text-red-400';
    if (percentage > 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="text-xs text-muted-foreground mt-1">
      <span className={getColorClass()}>
        {currentLength} / {maxLength}
      </span>
      {' '}characters ({tierName} tier)
    </div>
  );
}
