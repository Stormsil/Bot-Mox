import { z } from 'zod';
import {
  authHeaderSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
  vmOpsActionSchema,
  vmOpsCommandCreateSchema,
  vmOpsCommandListQuerySchema,
  vmOpsCommandNextQuerySchema,
  vmOpsCommandSchema,
  vmOpsCommandUpdateSchema,
  vmOpsDispatchBodySchema,
} from './schemas.js';

export const contractRoutesVmOps = {
  vmOpsCommandById: {
    method: 'GET',
    path: '/api/v1/vm-ops/commands/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(vmOpsCommandSchema),
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Get command status',
  },
  vmOpsCommandCreate: {
    method: 'POST',
    path: '/api/v1/vm-ops/commands',
    headers: authHeaderSchema,
    body: vmOpsCommandCreateSchema,
    responses: {
      202: successEnvelopeSchema(vmOpsCommandSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Dispatch arbitrary VM operation command',
  },
  vmOpsCommandList: {
    method: 'GET',
    path: '/api/v1/vm-ops/commands',
    headers: authHeaderSchema,
    query: vmOpsCommandListQuerySchema,
    responses: {
      200: successEnvelopeSchema(z.array(vmOpsCommandSchema)),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'List VM operation commands',
  },
  vmOpsCommandNext: {
    method: 'GET',
    path: '/api/v1/vm-ops/commands/next',
    headers: authHeaderSchema,
    query: vmOpsCommandNextQuerySchema,
    responses: {
      200: successEnvelopeSchema(z.union([vmOpsCommandSchema, z.null()])),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Long-poll next queued command for agent',
  },
  vmOpsCommandPatch: {
    method: 'PATCH',
    path: '/api/v1/vm-ops/commands/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    body: vmOpsCommandUpdateSchema,
    responses: {
      200: successEnvelopeSchema(vmOpsCommandSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Update command status from agent',
  },
  vmOpsDispatchProxmox: {
    method: 'POST',
    path: '/api/v1/vm-ops/proxmox/:action',
    headers: authHeaderSchema,
    pathParams: z.object({
      action: vmOpsActionSchema,
    }),
    body: vmOpsDispatchBodySchema,
    responses: {
      200: successEnvelopeSchema(vmOpsCommandSchema),
      202: successEnvelopeSchema(vmOpsCommandSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Dispatch proxmox command through agent queue',
  },
  vmOpsDispatchSyncthing: {
    method: 'POST',
    path: '/api/v1/vm-ops/syncthing/:action',
    headers: authHeaderSchema,
    pathParams: z.object({
      action: vmOpsActionSchema,
    }),
    body: vmOpsDispatchBodySchema,
    responses: {
      200: successEnvelopeSchema(vmOpsCommandSchema),
      202: successEnvelopeSchema(vmOpsCommandSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Dispatch syncthing command through agent queue',
  },
} as const;
