import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/platform/auth/api';
import { ServerErrorAlert } from '@/platform/auth/components/server-error-alert';
import { SubmitButton } from '@/platform/auth/components/submit-button';
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
  type ForgotPasswordValues,
} from '@/platform/auth/schemas';
import { translateValidationMessage } from '@/platform/auth/validation';

interface ForgotPasswordFormProps {
  /** Prefill, e.g. the address entered before ("Zurück" from "Prüfe dein Postfach"). */
  defaultEmail?: string;
  /** The reset link is on its way if the account exists (neutral outcome). */
  onSubmitted: (email: string) => void;
}

export function ForgotPasswordForm({ defaultEmail = '', onSubmitted }: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const form = useForm<ForgotPasswordInput, unknown, ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });
  const { errors } = form.formState;
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);

  const submit = form.handleSubmit(async ({ email }) => {
    setPending(true);
    setServerError(null);
    try {
      await requestPasswordReset(email);
      onSubmitted(email);
    } catch (error) {
      setServerError(error);
      setPending(false);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      {serverError !== null ? <ServerErrorAlert error={serverError} /> : null}

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
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </Field>

      <SubmitButton pending={pending} className="w-full">
        {t('auth.forgot.submit')}
      </SubmitButton>
    </form>
  );
}
