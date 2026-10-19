import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import type { HomeNotice } from '@/app/pages/home-notice';
import { isPasswordSetupState } from '@/app/pages/password-setup-state';
import { textLinkClassName } from '@/app/pages/text-link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AuthCard, ResetPasswordForm } from '@/platform/auth';

/**
 * Reachable only with a session from an e-mail link (middleware requireEmailLinkSession), in two
 * modes: after a recovery link ("Neues Passwort festlegen") and, right after an account's first
 * confirmation, as the optional "Passwort festlegen" step (navigation state from /auth/confirm).
 * The mode only changes texts and the way out; the form and the server rules are the same.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setup = isPasswordSetupState(location.state);

  const newLinkAction = (
    <Link
      to="/forgot-password"
      className={cn(textLinkClassName, 'inline-flex min-h-11 items-center')}
    >
      {t('auth.reset.requestNewLink')}
    </Link>
  );

  if (setup) {
    return (
      <AuthCard
        title={t('auth.setup.title')}
        description={t('auth.setup.description')}
        footer={
          // Skipping only leaves the page: the account keeps signing in by e-mail link.
          <Button asChild variant="outline" className="w-full">
            <Link to="/" replace>
              {t('auth.setup.skip')}
            </Link>
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">{t('auth.setup.hint')}</p>
        <ResetPasswordForm
          newLinkAction={newLinkAction}
          // No "other devices" notice: there was no earlier password whose holders could still be
          // signed in (the database drops one chosen before the first confirmation, E-46).
          onPasswordUpdated={() => {
            const notice: HomeNotice = 'passwordSet';
            void navigate('/', { replace: true, state: { notice } });
          }}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('auth.reset.title')}
      description={t('auth.reset.description')}
      footer={
        <Link to="/" className={cn(textLinkClassName, 'inline-flex min-h-11 items-center')}>
          {t('auth.reset.cancel')}
        </Link>
      }
    >
      <ResetPasswordForm
        newLinkAction={newLinkAction}
        onPasswordUpdated={({ otherSessionsSignedOut }) => {
          const notice: HomeNotice = otherSessionsSignedOut
            ? 'passwordUpdated'
            : 'passwordUpdatedOthersPending';
          void navigate('/', { replace: true, state: { notice } });
        }}
      />
    </AuthCard>
  );
}
