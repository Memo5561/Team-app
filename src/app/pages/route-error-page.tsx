import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';
import { CenteredMessage } from '@/app/pages/centered-message';
import { Button } from '@/components/ui/button';

/** Catches render/loader errors below the root route. Never shows technical details (spec §61). */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();

  useEffect(() => {
    // Error tracking (Sentry, EU region) is wired up in a later phase; until then log locally.
    console.error(error);
  }, [error]);

  return (
    <CenteredMessage title={t('errorBoundary.title')} description={t('errorBoundary.description')}>
      <Button
        onClick={() => {
          window.location.reload();
        }}
      >
        {t('errorBoundary.reload')}
      </Button>
    </CenteredMessage>
  );
}
