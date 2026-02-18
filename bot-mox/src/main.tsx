import './observability/otel'
import { initClientLogTransport } from './observability/clientLogTransport'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

initClientLogTransport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
