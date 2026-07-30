import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-6 text-center max-w-md mx-auto">
            <h2 className="text-lg font-bold text-[var(--color-danger-text)]">出错了</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{this.state.error?.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 px-4 py-2 rounded-[length:var(--radius-control)] bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              重试
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
