import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CenteredMessage } from '@/app/pages/centered-message';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <CenteredMessage
      title={t('notFound.title')}
      description={t('notFound.description')}
      pageTitle={t('notFound.title')}
    >
      <Button asChild>
        <Link to="/">{t('notFound.backHome')}</Link>
      </Button>
    </CenteredMessage>
  );
}
