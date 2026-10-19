import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { AuthCard } from '@/platform/auth/components/auth-card';

export type CheckInboxVariant = 'signup' | 'magicLink' | 'recovery' | 'resend';

interface CheckInboxProps {
  email: string;
  variant: CheckInboxVariant;
  onBack: () => void;
}

/**
 * Neutral result after any request that sends an e-mail. It looks the same whether or not an
 * account exists, a mail was actually sent or the mail rate limit was hit (account enumeration).
 */
export function CheckInbox({ email, variant, onBack }: CheckInboxProps) {
  const { t } = useTranslation();
  return (
    <AuthCard
      title={t('auth.checkInbox.title')}
      focusTitleOnMount
      footer={
        <Button type="button" variant="outline" className="w-full" onClick={onBack}>
          {t('auth.checkInbox.back')}
        </Button>
      }
    >
      <div role="status" className="grid gap-3">
        {/* wrap-anywhere: long addresses must not widen the card beyond a phone screen. */}
        <p className="text-base wrap-anywhere">{t(`auth.checkInbox.${variant}`, { email })}</p>
        <p className="text-sm text-muted-foreground">{t('auth.checkInbox.hint')}</p>
      </div>
    </AuthCard>
  );
}
