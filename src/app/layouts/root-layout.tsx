import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';

/**
 * Outermost layout. Desktop sidebar and mobile bottom navigation follow in Phase 5.
 * After client-side navigation, focus moves to the new page's <h1> so screen-reader and keyboard
 * users notice the page change (no focus move on the initial load).
 */
export function RootLayout() {
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    containerRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [pathname]);

  return (
    <div ref={containerRef} className="min-h-dvh bg-background text-foreground">
      <Outlet />
    </div>
  );
}
