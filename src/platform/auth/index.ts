// Public API of the auth platform module. App code imports from '@/platform/auth' only.
export {
  getCurrentSession,
  isEmailLinkSession,
  verifyEmailLink,
  type EmailLinkType,
  type Profile,
} from '@/platform/auth/api';
export type { AuthState, SignedOutNotice, SignedOutReason } from '@/platform/auth/auth-context';
export { AuthProvider } from '@/platform/auth/auth-provider';
export { AuthCard } from '@/platform/auth/components/auth-card';
export { CheckInbox, type CheckInboxVariant } from '@/platform/auth/components/check-inbox';
export { ForgotPasswordForm } from '@/platform/auth/components/forgot-password-form';
export { LoginForm } from '@/platform/auth/components/login-form';
export { ResetPasswordForm } from '@/platform/auth/components/reset-password-form';
export { ServerErrorAlert } from '@/platform/auth/components/server-error-alert';
export { SignUpForm, type SignUpDetails } from '@/platform/auth/components/signup-form';
export { SubmitButton } from '@/platform/auth/components/submit-button';
export { useAuth, useProfile } from '@/platform/auth/hooks';
