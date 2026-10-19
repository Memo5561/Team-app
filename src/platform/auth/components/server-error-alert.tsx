import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getErrorMessageKey } from '@/lib/errors';

interface ServerErrorAlertProps {
  /** The raw error; only its mapped, translated message is shown. */
  error: unknown;
  /** Optional follow-up action, e.g. "resend confirmation e-mail". */
  children?: ReactNode;
}

/** Error from a request, announced and focused so keyboard and screen-reader users notice it. */
export function ServerErrorAlert({ error, children }: ServerErrorAlertProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [error]);

  return (
    <Alert ref={ref} tabIndex={-1} variant="destructive">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
      <AlertDescription>
        <p>{t(getErrorMessageKey(error))}</p>
        {children}
      </AlertDescription>
    </Alert>
  );
}
