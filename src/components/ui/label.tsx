import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// shadcn/ui label without the Radix dependency: a plain <label>, associated via htmlFor.
function Label({ className, htmlFor, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      htmlFor={htmlFor}
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
