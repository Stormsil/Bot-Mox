import './observability/otel';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initClientLogTransport } from './observability/clientLogTransport';

async function bootstrap(): Promise<void> {
  if (import.meta.env.MODE === 'frontend-only') {
    const { installFrontendOnlyMockApi } = await import('./dev/installFrontendOnlyMockApi');
    installFrontendOnlyMockApi();
  }

  initClientLogTransport();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element "#root" was not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
