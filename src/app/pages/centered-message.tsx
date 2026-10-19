import type { ReactNode } from 'react';

interface CenteredMessageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/** Full-page message used by the home placeholder, 404 and error pages. */
export function CenteredMessage({ title, description, children }: CenteredMessageProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-base text-muted-foreground">{description}</p>
      {children}
    </main>
  );
}
