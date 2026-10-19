import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';

/** Full-page loading state: initial route check (HydrateFallback) and pending auth state. */
export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground"
    >
      <Spinner className="size-8" />
      <span className="sr-only">{t('app.loading')}</span>
    </div>
  );
}
