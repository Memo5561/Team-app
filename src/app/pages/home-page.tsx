import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { readHomeNotice } from '@/app/pages/home-notice';
import { textLinkClassName } from '@/app/pages/text-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ServerErrorAlert, SubmitButton, useAuth, useProfile } from '@/platform/auth';

type SignOutScope = 'local' | 'global';

/**
 * Start page after sign-in. Phase 1: greeting, empty state (no organization yet) and sign-out.
 * Organization setup follows in Phase 2, the dashboard in Phase 6.
 */
export function HomePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, signOut } = useAuth();
  const profile = useProfile();
  const [pending, setPending] = useState<SignOutScope | null>(null);
  const [signOutError, setSignOutError] = useState<unknown>(null);
  // One-time notice from navigation state: kept for this visit, but removed from the history entry
  // so that a reload or back navigation does not show it again.
  const [notice] = useState(() => readHomeNotice(location.state));
  const historyHasNotice = readHomeNotice(location.state) !== null;
  useEffect(() => {
    if (!historyHasNotice) return;
    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  }, [historyHasNotice, location.pathname, location.search, location.hash, navigate]);
  const email = state.status === 'signedIn' ? state.user.email : undefined;
  const displayName = profile.data?.displayName;

  async function handleSignOut(scope: SignOutScope) {
    if (pending !== null) return;
    setPending(scope);
    setSignOutError(null);
    // On success ProtectedLayout leads to /login. An error only reaches this page if the local
    // session is still intact.
    const { error } = await signOut(scope);
    if (error !== null && error !== undefined) setSignOutError(error);
    setPending(null);
  }

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-8 sm:py-12">
      <title>{t('app.name')}</title>
      <header className="grid gap-1" aria-busy={profile.isPending || undefined}>
        <p className="text-sm font-semibold tracking-tight text-primary">{t('app.name')}</p>
        {/* tabIndex -1: RootLayout moves focus here after client-side navigation. */}
        <h1
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight wrap-anywhere outline-none"
        >
          {displayName ? t('home.greeting', { name: displayName }) : t('home.greetingFallback')}
        </h1>
        {email ? (
          <p className="text-sm break-all text-muted-foreground">
            {t('home.signedInAs', { email })}
          </p>
        ) : null}
      </header>

      {notice !== null ? (
        <Alert role="status" variant={notice === 'weakPassword' ? 'info' : 'success'}>
          <AlertDescription>
            <p>{t(`home.notices.${notice}`)}</p>
            {notice === 'weakPassword' ? (
              <Link
                to="/forgot-password"
                className={cn(textLinkClassName, 'inline-flex min-h-11 items-center')}
              >
                {t('home.changePassword')}
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {profile.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{t('home.profileError')}</p>
            <SubmitButton
              type="button"
              variant="outline"
              className="mt-2"
              pending={profile.isFetching}
              onClick={() => void profile.refetch()}
            >
              {t('home.retry')}
            </SubmitButton>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2 className="text-xl">{t('home.emptyTitle')}</h2>
          </CardTitle>
          <CardDescription className="text-base">{t('home.emptyDescription')}</CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3">
        {signOutError !== null ? <ServerErrorAlert error={signOutError} /> : null}
        <div className="grid gap-3 sm:flex">
          <SubmitButton
            type="button"
            variant="outline"
            pending={pending === 'local'}
            busy={pending !== null}
            onClick={() => void handleSignOut('local')}
          >
            {t('home.signOut')}
          </SubmitButton>
          <SubmitButton
            type="button"
            variant="ghost"
            pending={pending === 'global'}
            busy={pending !== null}
            onClick={() => void handleSignOut('global')}
          >
            {t('home.signOutEverywhere')}
          </SubmitButton>
        </div>
        <p className="text-sm text-muted-foreground">{t('home.signOutEverywhereHint')}</p>
      </section>
    </main>
  );
}
