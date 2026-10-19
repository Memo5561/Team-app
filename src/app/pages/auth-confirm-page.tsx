import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { PASSWORD_SETUP_STATE } from '@/app/pages/password-setup-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getAuthErrorCode, getErrorMessageKey } from '@/lib/errors';
import {
  AuthCard,
  ServerErrorAlert,
  SubmitButton,
  useAuth,
  verifyEmailLink,
  type EmailLinkType,
} from '@/platform/auth';

interface EmailLink {
  tokenHash: string;
  type: EmailLinkType;
}

/** Only sign-up/magic-link (`email`) and password recovery links are handled in Phase 1. */
function readEmailLink(search: string): EmailLink | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash === null || tokenHash === '') return null;
  if (type !== 'email' && type !== 'recovery') return null;
  return { tokenHash, type };
}

function isInvalidLinkError(error: unknown): boolean {
  return (
    getErrorMessageKey(error) === 'errors.linkInvalid' ||
    getAuthErrorCode(error) === 'validation_failed'
  );
}

type Status = 'ready' | 'pending' | 'invalid';

/**
 * Landing page of every auth e-mail link. The token is moved from the URL into state right away
 * (it must not stay in the address bar or history) and only verified after an explicit click, so
 * mail scanners that open links cannot use up the one-time token.
 */
export function AuthConfirmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, signOut } = useAuth();
  const [link] = useState(() => readEmailLink(location.search));
  const [status, setStatus] = useState<Status>(link === null ? 'invalid' : 'ready');
  const [failedAttempt, setFailedAttempt] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (location.search !== '' || location.hash !== '') {
      void navigate('/auth/confirm', { replace: true });
    }
  }, [location.search, location.hash, navigate]);

  async function confirm() {
    if (link === null || status === 'pending') return;
    setStatus('pending');
    setError(null);
    try {
      // Never mix accounts: whoever is signed in on this device is signed out first.
      if (state.status === 'signedIn') await signOut('local');
      const { firstConfirmation } = await verifyEmailLink(link.tokenHash, link.type);
      if (link.type === 'recovery') {
        void navigate('/reset-password', { replace: true });
      } else if (firstConfirmation) {
        // Optional step: set a password now or keep signing in by e-mail link (E-46).
        void navigate('/reset-password', { replace: true, state: PASSWORD_SETUP_STATE });
      } else {
        void navigate('/', { replace: true });
      }
    } catch (caught) {
      setFailedAttempt(true);
      if (isInvalidLinkError(caught)) {
        setStatus('invalid');
      } else {
        setError(caught);
        setStatus('ready');
      }
    }
  }

  if (status === 'invalid' || link === null) {
    return (
      <AuthCard
        title={t('auth.confirm.invalidTitle')}
        description={t('auth.confirm.invalidDescription')}
        focusTitleOnMount={failedAttempt}
      >
        <div className="grid gap-3">
          <Button asChild>
            <Link to="/login">{t('auth.confirm.toLogin')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/forgot-password">{t('auth.confirm.toForgotPassword')}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  const isRecovery = link.type === 'recovery';
  return (
    <AuthCard
      title={isRecovery ? t('auth.confirm.recoveryTitle') : t('auth.confirm.emailTitle')}
      description={
        isRecovery ? t('auth.confirm.recoveryDescription') : t('auth.confirm.emailDescription')
      }
    >
      {error !== null ? <ServerErrorAlert error={error} /> : null}
      {state.status === 'signedIn' ? (
        <Alert role="status" variant="info">
          <AlertDescription>
            {t('auth.confirm.signedInAs', { email: state.user.email ?? '' })}
          </AlertDescription>
        </Alert>
      ) : null}
      {/* Busy until the auth state is known: whether someone must be signed out first. */}
      <SubmitButton
        type="button"
        className="w-full"
        pending={status === 'pending' || state.status === 'loading'}
        onClick={() => void confirm()}
      >
        {t('auth.confirm.continue')}
      </SubmitButton>
    </AuthCard>
  );
}
