import {
  clientLogsIngestResultSchema,
  clientLogsIngestSchema,
  diagnosticsTraceResponseSchema,
  errorEnvelopeSchema,
  healthLiveSchema,
  healthReadySchema,
  successEnvelopeSchema,
} from './schemas.js';

export const contractRoutesCore = {
  clientLogsIngest: {
    method: 'POST',
    path: '/api/v1/client-logs',
    body: clientLogsIngestSchema,
    responses: {
      200: successEnvelopeSchema(clientLogsIngestResultSchema),
      400: errorEnvelopeSchema,
      429: errorEnvelopeSchema,
    },
    summary: 'Ingest frontend structured logs',
  },
  diagnosticsTrace: {
    method: 'GET',
    path: '/api/v1/diag/trace',
    responses: {
      200: successEnvelopeSchema(diagnosticsTraceResponseSchema),
      404: errorEnvelopeSchema,
    },
    summary: 'Get diagnostic trace context snapshot',
  },
  healthLive: {
    method: 'GET',
    path: '/api/v1/health/live',
    responses: {
      200: successEnvelopeSchema(healthLiveSchema),
    },
    summary: 'Get liveness check',
  },
  healthReady: {
    method: 'GET',
    path: '/api/v1/health/ready',
    responses: {
      200: successEnvelopeSchema(healthReadySchema),
      503: successEnvelopeSchema(healthReadySchema),
    },
    summary: 'Get readiness check',
  },
} as const;
