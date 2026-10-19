import type { ComponentProps, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type SubmitButtonProps = ComponentProps<typeof Button> & {
  /** Shows the spinner and aria-busy on this button. */
  pending: boolean;
  /** Ignores activation while any request of the form runs (defaults to `pending`). */
  busy?: boolean;
};

/**
 * Button that stays enabled while a request runs (keeps focus and is announced as busy) but
 * ignores further clicks and Enter-key submissions until the request has finished.
 */
export function SubmitButton({
  pending,
  busy = pending,
  type = 'submit',
  onClick,
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      type={type}
      aria-busy={pending || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
