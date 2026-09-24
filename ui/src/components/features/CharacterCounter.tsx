/**
 * Props for the CharacterCounter component
 */
interface CharacterCounterProps {
  /** Current number of characters in the text field */
  currentLength: number;
  /** Maximum allowed characters */
  maxLength: number;
  /** Label for the counter (e.g., "Text" or "Context") */
  label: string;
}

export function CharacterCounter({
  currentLength,
  maxLength,
  label,
}: CharacterCounterProps) {
  const overLimit = currentLength > maxLength;

  return (
    <div className={`mt-1 text-right text-xs tabular-nums ${overLimit ? 'text-destructive' : 'text-tertiary'}`}>
      <span>
        {currentLength} / {maxLength}
      </span>
    </div>
  );
}
