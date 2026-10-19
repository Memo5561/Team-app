import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';
import { CenteredMessage } from '@/app/pages/centered-message';
import { Button } from '@/components/ui/button';
import { getErrorMessageKey } from '@/lib/errors';

/** Catches render/loader errors below the root route. Never shows technical details (spec §61). */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  // E.g. the session check at app start when the phone is offline: say so instead of "support".
  const offline = getErrorMessageKey(error) === 'errors.network';
  const title = offline ? t('errorBoundary.networkTitle') : t('errorBoundary.title');

  useEffect(() => {
    // Error tracking (Sentry, EU region) is wired up in a later phase; until then log locally.
    console.error(error);
  }, [error]);

  return (
    <CenteredMessage
      title={title}
      description={offline ? t('errorBoundary.networkDescription') : t('errorBoundary.description')}
      pageTitle={title}
    >
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
