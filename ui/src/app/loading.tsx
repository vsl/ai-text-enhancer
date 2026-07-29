import { LoadingSpinner } from '@/components/features/LoadingSpinner';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <LoadingSpinner />
      <span className="sr-only">Loading application...</span>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
