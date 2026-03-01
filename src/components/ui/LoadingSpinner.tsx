type SpinnerSize = 'sm' | 'md' | 'lg';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-label="Loading" className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} rounded-full border-surface-300 border-t-primary-400 animate-spin`}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
