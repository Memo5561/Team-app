import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { textLinkClassName } from '@/app/pages/text-link';
import { cn } from '@/lib/utils';
import { AuthCard, CheckInbox, ForgotPasswordForm, useAuth } from '@/platform/auth';

/**
 * Open with and without a session: signed-in users get here from hints like "weak password" and
 * request the link for their own address (prefilled when the auth state is already known).
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { state } = useAuth();
  // The address sent to last: shown in "Prüfe dein Postfach" and prefilled again after "Zurück".
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showInbox, setShowInbox] = useState(false);
  const signedIn = state.status === 'signedIn';

  if (showInbox && sentTo !== null) {
    return (
      <CheckInbox
        email={sentTo}
        variant="recovery"
        onBack={() => {
          setShowInbox(false);
        }}
      />
    );
  }

  return (
    <AuthCard
      title={t('auth.forgot.title')}
      description={t('auth.forgot.description')}
      focusTitleOnMount={sentTo !== null}
      footer={
        <Link
          to={signedIn ? '/' : '/login'}
          className={cn(textLinkClassName, 'inline-flex min-h-11 items-center')}
        >
          {signedIn ? t('auth.forgot.backToHome') : t('auth.forgot.backToLogin')}
        </Link>
      }
    >
      <ForgotPasswordForm
        defaultEmail={sentTo ?? (signedIn ? state.user.email : undefined)}
        onSubmitted={(email) => {
          setSentTo(email);
          setShowInbox(true);
        }}
      />
    </AuthCard>
  );
}
