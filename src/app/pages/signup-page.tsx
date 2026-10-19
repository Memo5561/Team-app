import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { textLinkClassName } from '@/app/pages/text-link';
import { cn } from '@/lib/utils';
import { AuthCard, CheckInbox, SignUpForm, type SignUpDetails } from '@/platform/auth';

export function SignupPage() {
  const { t } = useTranslation();
  // What was sent last: shown in "Prüfe dein Postfach" and prefilled again after "Zurück".
  const [submitted, setSubmitted] = useState<SignUpDetails | null>(null);
  const [showInbox, setShowInbox] = useState(false);

  if (showInbox && submitted !== null) {
    return (
      <CheckInbox
        email={submitted.email}
        variant="signup"
        onBack={() => {
          setShowInbox(false);
        }}
      />
    );
  }

  return (
    <AuthCard
      title={t('auth.signup.title')}
      description={t('auth.signup.description')}
      focusTitleOnMount={submitted !== null}
      footer={
        <>
          <span className="text-muted-foreground">{t('auth.signup.haveAccount')}</span>
          <Link to="/login" className={cn(textLinkClassName, 'inline-flex min-h-11 items-center')}>
            {t('auth.signup.loginLink')}
          </Link>
        </>
      }
    >
      <SignUpForm
        defaultValues={submitted ?? undefined}
        onSubmitted={(details) => {
          setSubmitted(details);
          setShowInbox(true);
        }}
      />
    </AuthCard>
  );
}
