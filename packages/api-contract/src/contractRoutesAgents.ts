import { z } from 'zod';
import {
  agentHeartbeatSchema,
  agentListQuerySchema,
  agentPairingCreateSchema,
  agentPairingRecordSchema,
  agentRecordSchema,
  authHeaderSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
} from './schemas.js';

export const contractRoutesAgents = {
  agentsCreatePairing: {
    method: 'POST',
    path: '/api/v1/agents/pairings',
    headers: authHeaderSchema,
    body: agentPairingCreateSchema,
    responses: {
      201: successEnvelopeSchema(agentPairingRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Create agent pairing code',
  },
  agentsHeartbeat: {
    method: 'POST',
    path: '/api/v1/agents/heartbeat',
    headers: authHeaderSchema,
    body: agentHeartbeatSchema,
    responses: {
      200: successEnvelopeSchema(z.record(z.unknown())),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Agent heartbeat',
  },
  agentsList: {
    method: 'GET',
    path: '/api/v1/agents',
    headers: authHeaderSchema,
    query: agentListQuerySchema,
    responses: {
      200: successEnvelopeSchema(z.array(agentRecordSchema)),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'List tenant agents',
  },
} as const;
