import { Outlet } from 'react-router';

/** Outermost layout. Desktop sidebar and mobile bottom navigation follow in Phase 5. */
export function RootLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Outlet />
    </div>
  );
}
