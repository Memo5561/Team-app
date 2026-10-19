import { useTranslation } from 'react-i18next';
import { CenteredMessage } from '@/app/pages/centered-message';

/** Phase 0 placeholder. Replaced by the dashboard in Phase 6. */
export function HomePage() {
  const { t } = useTranslation();
  return (
    <CenteredMessage title={t('home.title')} description={t('home.subtitle')}>
      <p className="text-sm text-muted-foreground">{t('home.status')}</p>
    </CenteredMessage>
  );
}
