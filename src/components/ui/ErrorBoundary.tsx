import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, RotateCcw, Copy, Check, Terminal } from 'lucide-react'
import { useErrorLogStore } from '@/core/store/useErrorLogStore'

// --- Global Error Boundary ---

export interface GlobalErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface GlobalErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
}

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    useErrorLogStore
      .getState()
      .logError('GlobalErrorBoundary', error.message, { stack: errorInfo.componentStack }, 'ERROR', error.stack)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleHardReset = (): void => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // ignore
    }
    window.location.reload()
  }

  handleCopyDiagnostics = (): void => {
    const diagnostics = JSON.stringify(
      {
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      },
      null,
      2
    )

    if (navigator.clipboard) {
      navigator.clipboard.writeText(diagnostics)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      return (
        <div className="global-error-screen" data-testid="global-error-screen">
          <div className="global-error-card">
            <div className="global-error-header">
              <div className="global-error-icon-box">
                <AlertTriangle size={32} className="text-sell" />
              </div>
              <div>
                <h1 className="global-error-title">TERMINAL KERNEL PANIC</h1>
                <p className="global-error-subtitle">
                  An unhandled exception occurred in the terminal execution thread.
                </p>
              </div>
            </div>

            <div className="global-error-body">
              <div className="error-message-box">
                <span className="error-badge">EXCEPTION</span>
                <code className="error-text">
                  {this.state.error?.message || 'Unknown runtime error'}
                </code>
              </div>

              {this.state.error?.stack && (
                <details className="error-stack-details">
                  <summary className="error-stack-summary">
                    <Terminal size={14} className="inline mr-1" />
                    Stack Trace & Diagnostics
                  </summary>
                  <pre className="error-stack-pre">
                    {this.state.error.stack}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="global-error-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReset}
                data-testid="reload-terminal-btn"
              >
                <RefreshCw size={14} className="inline mr-1.5" />
                Reload Terminal State
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={this.handleCopyDiagnostics}
                data-testid="copy-diagnostics-btn"
              >
                {this.state.copied ? (
                  <>
                    <Check size={14} className="inline mr-1.5 text-buy" />
                    Copied Diagnostics
                  </>
                ) : (
                  <>
                    <Copy size={14} className="inline mr-1.5" />
                    Copy Crash Report
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={this.handleHardReset}
                title="Clears local cache and reloads browser"
              >
                <RotateCcw size={14} className="inline mr-1.5" />
                Reset Workspace
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// --- Widget-Level Error Boundary ---

export interface WidgetErrorBoundaryProps {
  widgetName: string
  children: ReactNode
  onReset?: () => void
}

interface WidgetErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    useErrorLogStore
      .getState()
      .logError(
        `Widget:${this.props.widgetName}`,
        error.message,
        { stack: errorInfo.componentStack },
        'ERROR',
        error.stack
      )
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="widget-error-fallback"
          data-testid={`widget-error-${this.props.widgetName.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="widget-error-content">
            <AlertTriangle size={24} className="widget-error-icon text-sell" />
            <h3 className="widget-error-title">{this.props.widgetName} Subsystem Failed</h3>
            <p className="widget-error-desc">
              {this.state.error?.message || 'An error occurred while rendering this widget.'}
            </p>
            <button
              type="button"
              className="widget-retry-btn"
              onClick={this.handleRetry}
              data-testid="widget-retry-btn"
            >
              <RefreshCw size={12} className="inline mr-1" />
              Retry Component
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC utility
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  widgetName: string
): React.FC<P> {
  const ComponentWithErrorBoundary: React.FC<P> = (props: P) => (
    <WidgetErrorBoundary widgetName={widgetName}>
      <WrappedComponent {...props} />
    </WidgetErrorBoundary>
  )
  ComponentWithErrorBoundary.displayName = `WithErrorBoundary(${widgetName})`
  return ComponentWithErrorBoundary
}
