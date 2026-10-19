import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { getErrorMessageKey } from '@/lib/errors';
import { signOut, updatePassword } from '@/platform/auth/api';
import { ServerErrorAlert } from '@/platform/auth/components/server-error-alert';
import { SubmitButton } from '@/platform/auth/components/submit-button';
import {
  resetPasswordSchema,
  type ResetPasswordInput,
  type ResetPasswordValues,
} from '@/platform/auth/schemas';
import { translateValidationMessage } from '@/platform/auth/validation';

interface ResetPasswordFormProps {
  /** Shown with errors that need a new e-mail link (e.g. a link to "Passwort vergessen"). */
  newLinkAction?: ReactNode;
  /** `otherSessionsSignedOut` is false if signing out the other devices failed. */
  onPasswordUpdated: (result: { otherSessionsSignedOut: boolean }) => void;
}

/** Sets a new password in a session that was established via e-mail link. */
export function ResetPasswordForm({ newLinkAction, onPasswordUpdated }: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const form = useForm<ResetPasswordInput, unknown, ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { errors } = form.formState;
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);

  const submit = form.handleSubmit(async ({ password }) => {
    setPending(true);
    setServerError(null);
    try {
      await updatePassword(password);
    } catch (error) {
      setServerError(error);
      setPending(false);
      return;
    }
    // Whoever had the old password must not stay signed in elsewhere.
    const { error } = await signOut('others');
    onPasswordUpdated({ otherSessionsSignedOut: error === null || error === undefined });
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      {serverError !== null ? (
        <ServerErrorAlert error={serverError}>
          {getErrorMessageKey(serverError) === 'errors.newLinkRequired' ? newLinkAction : null}
        </ServerErrorAlert>
      ) : null}

      <Field
        label={t('auth.fields.newPassword')}
        error={translateValidationMessage(t, errors.password?.message)}
        required
      >
        {(control) => (
          <PasswordInput {...control} {...form.register('password')} autoComplete="new-password" />
        )}
      </Field>

      <Field
        label={t('auth.fields.confirmPassword')}
        error={translateValidationMessage(t, errors.confirmPassword?.message)}
        required
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('confirmPassword')}
            autoComplete="new-password"
          />
        )}
      </Field>

      <SubmitButton pending={pending} className="w-full">
        {t('auth.reset.submit')}
      </SubmitButton>
    </form>
  );
}
