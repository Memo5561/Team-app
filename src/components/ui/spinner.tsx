import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Decorative loading indicator. Always hidden from assistive technology: the surrounding element
 * announces the state (aria-busy on buttons, role="status" with translated text on pages).
 */
function Spinner({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      data-slot="spinner"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('size-4 animate-spin', className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export { Spinner };
