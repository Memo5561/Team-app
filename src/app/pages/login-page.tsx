import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { textLinkClassName } from '@/app/pages/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getSafeRedirect } from '@/lib/safe-redirect';
import { cn } from '@/lib/utils';
import { AuthCard, CheckInbox, LoginForm, useAuth } from '@/platform/auth';

interface SentState {
  email: string;
  kind: 'magicLink' | 'resend';
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useAuth();
  // The last request that sent a mail: shown in "Prüfe dein Postfach", prefilled after "Zurück".
  const [sent, setSent] = useState<SentState | null>(null);
  const [showInbox, setShowInbox] = useState(false);

  if (showInbox && sent !== null) {
    return (
      <CheckInbox
        email={sent.email}
        variant={sent.kind}
        onBack={() => {
          setShowInbox(false);
        }}
      />
    );
  }

  const sessionEnded = searchParams.get('reason') === 'signedOut';
  const globalSignOutIncomplete =
    state.status === 'signedOut' && state.notice === 'globalSignOutIncomplete';

  return (
    <AuthCard
      title={t('auth.login.title')}
      description={t('auth.login.description')}
      focusTitleOnMount={sent !== null}
      footer={
        <>
          <span className="text-muted-foreground">{t('auth.login.noAccount')}</span>
          <Link to="/signup" className={cn(textLinkClassName, 'inline-flex min-h-11 items-center')}>
            {t('auth.login.signupLink')}
          </Link>
        </>
      }
    >
      {globalSignOutIncomplete ? (
        <Alert role="status" variant="info">
          <AlertDescription>{t('auth.login.globalSignOutIncomplete')}</AlertDescription>
        </Alert>
      ) : null}
      {sessionEnded ? (
        <Alert role="status" variant="info">
          <AlertDescription>{t('auth.login.reasonSignedOut')}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm
        defaultEmail={sent?.email}
        forgotPasswordLink={
          <Link
            to="/forgot-password"
            className={cn(textLinkClassName, '-my-3 inline-flex items-center py-3 text-sm')}
          >
            {t('auth.login.forgotPassword')}
          </Link>
        }
        onSignedIn={({ weakPassword }) => {
          void navigate(getSafeRedirect(searchParams.get('next')) ?? '/', {
            replace: true,
            state: weakPassword ? { notice: 'weakPassword' } : undefined,
          });
        }}
        onEmailSent={(email, kind) => {
          setSent({ email, kind });
          setShowInbox(true);
        }}
      />
    </AuthCard>
  );
}
