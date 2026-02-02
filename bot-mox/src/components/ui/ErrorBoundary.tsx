import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message || 'An unexpected error occurred'}
          extra={[
            <Button
              key="reload"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.handleReload}
            >
              Reload Page
            </Button>,
            <Button key="retry" onClick={this.handleReset}>
              Try Again
            </Button>,
          ]}
        >
          {this.state.errorInfo && (
            <div style={{ marginTop: 24, textAlign: 'left' }}>
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary>Error Details</summary>
                {this.state.errorInfo.componentStack}
              </details>
            </div>
          )}
        </Result>
      );
    }

    return this.props.children;
  }
}
