import { Outlet } from 'react-router-dom';
import { ToastHost } from '../common/ToastHost';
import { ErrorBoundary } from '../../hooks/useErrorBoundary';
import { GlobalShortcuts } from './GlobalShortcuts';
import { Titlebar } from './Titlebar';
import { KbConversationSidebar } from './KbConversationSidebar';
import { ThemeBootstrap } from '../settings/ThemeBootstrap';
import { NavigationGuardDialog } from './NavigationGuardDialog';
import { DependencyHealthBanner } from '../common/DependencyHealthBanner';
import { SourcesPanelProvider } from '../../context/SourcesPanelContext';
import { WorkbenchShell } from './WorkbenchShell';

export function AppLayout() {
  return (
    <SourcesPanelProvider>
      <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
        <ThemeBootstrap />
        <NavigationGuardDialog />
        <ToastHost />
        <GlobalShortcuts />
        <Titlebar />
        <DependencyHealthBanner />
        <div className="flex flex-1 overflow-hidden">
          <KbConversationSidebar />
          <main
            className="flex min-w-0 flex-1 overflow-hidden"
            style={{ background: 'var(--gradient-page)' }}
          >
            <ErrorBoundary>
              <WorkbenchShell>
                <Outlet />
              </WorkbenchShell>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SourcesPanelProvider>
  );
}
