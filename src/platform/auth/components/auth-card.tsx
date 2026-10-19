import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthCardProps {
  /** Page heading (h1) and document title. */
  title: string;
  description?: ReactNode;
  /** Move focus to the heading on mount, e.g. when a form is replaced by a result view. */
  focusTitleOnMount?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Card used by every auth screen: h1 title, optional description, content and footer. */
export function AuthCard({
  title,
  description,
  focusTitleOnMount = false,
  children,
  footer,
}: AuthCardProps) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusTitleOnMount) titleRef.current?.focus();
  }, [focusTitleOnMount]);

  return (
    <Card>
      {/* React 19 hoists <title> into <head>. */}
      <title>{t('app.pageTitle', { page: title })}</title>
      <CardHeader>
        <CardTitle asChild>
          {/* tabIndex -1: focus target after navigation (RootLayout) and view changes. */}
          <h1 ref={titleRef} tabIndex={-1} className="outline-none">
            {title}
          </h1>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {children ? <CardContent className="grid gap-5">{children}</CardContent> : null}
      {footer ? (
        <CardFooter className="flex-wrap justify-center gap-x-1 gap-y-2 text-center text-sm">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
