import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

/** Centered single-card layout for the auth screens; full width on phones. */
export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-8 sm:justify-center sm:py-12">
      <div className="grid w-full max-w-md gap-6">
        <p className="text-center text-xl font-semibold tracking-tight text-primary">
          {t('app.name')}
        </p>
        <Outlet />
      </div>
    </main>
  );
}
