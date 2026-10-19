import { useTranslation } from 'react-i18next';
import { CenteredMessage } from '@/app/pages/centered-message';

interface ConfigErrorScreenProps {
  issues: readonly string[];
}

/**
 * Shown instead of the app when the environment is misconfigured. Deployed builds validate
 * the environment at build time, so end users should never see this screen.
 */
export function ConfigErrorScreen({ issues }: ConfigErrorScreenProps) {
  const { t } = useTranslation();
  return (
    <CenteredMessage title={t('config.title')} description={t('config.description')}>
      <section aria-label={t('config.detailsLabel')} className="w-full text-left">
        <ul className="list-disc space-y-1 rounded-md bg-muted p-4 pl-8 font-mono text-sm">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </section>
    </CenteredMessage>
  );
}
