import {
  authHeaderSchema,
  errorEnvelopeSchema,
  ipqsBatchResponseSchema,
  ipqsCheckBatchBodySchema,
  ipqsCheckBodySchema,
  ipqsCheckResponseSchema,
  ipqsStatusSchema,
  successEnvelopeSchema,
} from './schemas.js';

export const contractRoutesIpqs = {
  ipqsCheck: {
    method: 'POST',
    path: '/api/v1/ipqs/check',
    headers: authHeaderSchema,
    body: ipqsCheckBodySchema,
    responses: {
      200: successEnvelopeSchema(ipqsCheckResponseSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
      503: errorEnvelopeSchema,
    },
    summary: 'Check IP quality',
  },
  ipqsCheckBatch: {
    method: 'POST',
    path: '/api/v1/ipqs/check-batch',
    headers: authHeaderSchema,
    body: ipqsCheckBatchBodySchema,
    responses: {
      200: successEnvelopeSchema(ipqsBatchResponseSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
      503: errorEnvelopeSchema,
    },
    summary: 'Check IP quality in batch',
  },
  ipqsStatusGet: {
    method: 'GET',
    path: '/api/v1/ipqs/status',
    headers: authHeaderSchema,
    responses: {
      200: successEnvelopeSchema(ipqsStatusSchema),
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
    },
    summary: 'Get IPQS integration status',
  },
} as const;
