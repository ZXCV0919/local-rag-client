import { Outlet } from 'react-router-dom';
import { Group, Panel } from 'react-resizable-panels';
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
import { ColumnSplitterHandle } from '../common/PanelSplitterHandles';

const SIDEBAR_LAYOUT_KEY = 'ui.layout.sidebarMain.v2';

/** Percent layout map; drop corrupt / pixel-era values. */
function readPercentLayout(key: string, fallback: Record<string, number>): Record<string, number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const values = Object.values(parsed);
    if (values.length === 0 || values.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
      return fallback;
    }
    const sum = values.reduce((a, b) => a + b, 0);
    // Percent layouts should roughly sum to ~100; reject tiny pixel leftovers
    if (sum < 80 || sum > 120) return fallback;
    if (
      typeof parsed.sidebar === 'number' &&
      (parsed.sidebar < 8 || parsed.sidebar > 45)
    ) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function AppLayout() {
  // ~272px @ 1280–1440 宽屏约 19–21%，与设计令牌 --sidebar-width 对齐
  const defaultLayout = readPercentLayout(SIDEBAR_LAYOUT_KEY, { sidebar: 20, main: 80 });

  return (
    <SourcesPanelProvider>
      <div className="flex h-screen flex-col bg-[var(--color-bg-primary)]">
        <ThemeBootstrap />
        <NavigationGuardDialog />
        <ToastHost />
        <GlobalShortcuts />
        <Titlebar />
        <DependencyHealthBanner />
        <Group
          orientation="horizontal"
          className="flex min-h-0 flex-1 overflow-hidden"
          defaultLayout={defaultLayout}
          onLayoutChanged={(layout) => {
            try {
              localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(layout));
            } catch {
              /* ignore */
            }
          }}
        >
          <Panel
            id="sidebar"
            minSize={160}
            maxSize="40%"
            defaultSize={272}
            className="min-h-0 min-w-0"
          >
            <KbConversationSidebar />
          </Panel>
          <ColumnSplitterHandle id="split-sidebar-main" label="拖动调整侧栏宽度" />
          <Panel id="main" minSize="50%" defaultSize="80%" className="min-h-0 min-w-0">
            <main
              className="flex h-full min-w-0 flex-1 overflow-hidden"
              style={{ background: 'var(--gradient-page)' }}
            >
              <ErrorBoundary>
                <WorkbenchShell>
                  <Outlet />
                </WorkbenchShell>
              </ErrorBoundary>
            </main>
          </Panel>
        </Group>
      </div>
    </SourcesPanelProvider>
  );
}
