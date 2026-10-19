import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signUp } from '@/platform/auth/api';
import { ServerErrorAlert } from '@/platform/auth/components/server-error-alert';
import { SubmitButton } from '@/platform/auth/components/submit-button';
import { signUpSchema, type SignUpInput, type SignUpValues } from '@/platform/auth/schemas';
import { translateValidationMessage } from '@/platform/auth/validation';

export interface SignUpDetails {
  displayName: string;
  email: string;
}

interface SignUpFormProps {
  /** Prefill, e.g. what was entered before ("Zurück" from "Prüfe dein Postfach"). */
  defaultValues?: SignUpDetails;
  /** A confirmation / sign-in e-mail is on its way (always the same neutral outcome). */
  onSubmitted: (details: SignUpDetails) => void;
}

/**
 * Name and e-mail only. The account is always created via e-mail link; a password can be set after
 * the first confirmation (E-46: a password chosen before it could be someone else's).
 */
export function SignUpForm({ defaultValues, onSubmitted }: SignUpFormProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const form = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      displayName: defaultValues?.displayName ?? '',
      email: defaultValues?.email ?? '',
    },
  });
  const { errors } = form.formState;
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    setServerError(null);
    try {
      await signUp(values);
      onSubmitted({ displayName: values.displayName, email: values.email });
    } catch (error) {
      setServerError(error);
      setPending(false);
    }
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      {serverError !== null ? <ServerErrorAlert error={serverError} /> : null}

      <Field
        label={t('auth.fields.name')}
        error={translateValidationMessage(t, errors.displayName?.message)}
        required
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('displayName')}
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={200}
          />
        )}
      </Field>

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

      <p id={hintId} className="text-sm text-muted-foreground">
        {t('auth.signup.hint')}
      </p>

      <SubmitButton pending={pending} className="w-full" aria-describedby={hintId}>
        {t('auth.signup.submit')}
      </SubmitButton>
    </form>
  );
}
