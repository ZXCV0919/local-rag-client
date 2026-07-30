import { Outlet } from 'react-router-dom';
import { ToastHost } from '../common/ToastHost';
import { ErrorBoundary } from '../../hooks/useErrorBoundary';
import { GlobalShortcuts } from './GlobalShortcuts';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { ThemeBootstrap } from '../settings/ThemeBootstrap';
import { NavigationGuardDialog } from './NavigationGuardDialog';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      <ThemeBootstrap />
      <NavigationGuardDialog />
      <ToastHost />
      <GlobalShortcuts />
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--color-bg-primary)]">
          <ErrorBoundary>
            <div className="flex min-h-0 flex-1 flex-col">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}