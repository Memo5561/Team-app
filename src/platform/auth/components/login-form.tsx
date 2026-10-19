import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { getAuthErrorCode } from '@/lib/errors';
import { resendConfirmation, sendMagicLink, signInWithPassword } from '@/platform/auth/api';
import { ServerErrorAlert } from '@/platform/auth/components/server-error-alert';
import { SubmitButton } from '@/platform/auth/components/submit-button';
import {
  loginSchema,
  magicLinkSchema,
  type LoginInput,
  type LoginValues,
} from '@/platform/auth/schemas';
import { translateValidationMessage } from '@/platform/auth/validation';

type PendingAction = 'password' | 'magicLink' | 'resend';

interface LoginFormProps {
  /** Prefill, e.g. the address entered before ("Zurück" from "Prüfe dein Postfach"). */
  defaultEmail?: string;
  /** Link shown next to the password label ("Passwort vergessen?"). */
  forgotPasswordLink?: ReactNode;
  onSignedIn: (result: { weakPassword: boolean }) => void;
  /** A magic link or a new confirmation e-mail was requested (neutral outcome). */
  onEmailSent: (email: string, kind: 'magicLink' | 'resend') => void;
}

/** E-mail + password sign-in, with "sign-in link by e-mail" as the password-less alternative. */
export function LoginForm({
  defaultEmail = '',
  forgotPasswordLink,
  onSignedIn,
  onEmailSent,
}: LoginFormProps) {
  const { t } = useTranslation();
  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });
  const { errors } = form.formState;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [serverError, setServerError] = useState<unknown>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  function fail(error: unknown) {
    setServerError(error);
    setPending(null);
  }

  const submitPassword = form.handleSubmit(async (values) => {
    setPending('password');
    setServerError(null);
    setUnconfirmedEmail(null);
    try {
      onSignedIn(await signInWithPassword(values));
    } catch (error) {
      if (getAuthErrorCode(error) === 'email_not_confirmed') setUnconfirmedEmail(values.email);
      fail(error);
    }
  });

  async function requestMagicLink() {
    if (pending !== null) return;
    form.clearErrors('password');
    if (!(await form.trigger('email', { shouldFocus: true }))) return;
    const { email } = magicLinkSchema.parse({ email: form.getValues('email') });
    setPending('magicLink');
    setServerError(null);
    setUnconfirmedEmail(null);
    try {
      await sendMagicLink(email);
      onEmailSent(email, 'magicLink');
    } catch (error) {
      fail(error);
    }
  }

  async function resend() {
    if (pending !== null || unconfirmedEmail === null) return;
    setPending('resend');
    try {
      await resendConfirmation(unconfirmedEmail);
      onEmailSent(unconfirmedEmail, 'resend');
    } catch (error) {
      fail(error);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submitPassword(event)} className="grid gap-5">
      {serverError !== null ? (
        <ServerErrorAlert error={serverError}>
          {unconfirmedEmail !== null ? (
            // Full width and wrapping: the label is too long for one line on 360 px phones.
            <SubmitButton
              type="button"
              variant="outline"
              className="mt-2 h-auto min-h-11 w-full py-2 whitespace-normal"
              pending={pending === 'resend'}
              busy={pending !== null}
              onClick={() => void resend()}
            >
              {t('auth.login.resendConfirmation')}
            </SubmitButton>
          ) : null}
        </ServerErrorAlert>
      ) : null}

      <Field
        label={t('auth.fields.email')}
        error={translateValidationMessage(t, errors.email?.message)}
        required
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('email')}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </Field>

      <Field
        label={t('auth.fields.password')}
        error={translateValidationMessage(t, errors.password?.message)}
        labelAction={forgotPasswordLink}
        required
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('password')}
            autoComplete="current-password"
          />
        )}
      </Field>

      <SubmitButton pending={pending === 'password'} busy={pending !== null} className="w-full">
        {t('auth.login.submit')}
      </SubmitButton>

      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t('auth.login.or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-2">
        <SubmitButton
          type="button"
          variant="outline"
          className="w-full"
          pending={pending === 'magicLink'}
          busy={pending !== null}
          onClick={() => void requestMagicLink()}
        >
          {t('auth.login.magicLink')}
        </SubmitButton>
        <p className="text-center text-sm text-muted-foreground">{t('auth.login.magicLinkHint')}</p>
      </div>
    </form>
  );
}
