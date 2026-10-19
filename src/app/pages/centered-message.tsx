import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface CenteredMessageProps {
  title: string;
  description: string;
  /** Document title; omit to use the plain app name. */
  pageTitle?: string;
  children?: ReactNode;
}

/** Full-page message used by the 404, error and configuration error pages. */
export function CenteredMessage({ title, description, pageTitle, children }: CenteredMessageProps) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {/* React 19 hoists <title> into <head>. */}
      <title>{pageTitle ? t('app.pageTitle', { page: pageTitle }) : t('app.name')}</title>
      {/* tabIndex -1: RootLayout moves focus here after client-side navigation. */}
      <h1 tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none">
        {title}
      </h1>
      <p className="text-base text-muted-foreground">{description}</p>
      {children}
    </main>
  );
}
