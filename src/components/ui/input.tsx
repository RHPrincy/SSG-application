import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-[var(--radius)] border border-border bg-bg px-3 text-sm text-ink',
        'placeholder:text-faint transition-colors',
        'focus-visible:outline-none focus-visible:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/25',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-medium uppercase tracking-wide text-muted', className)}
      {...props}
    />
  );
}
