import { z } from 'zod';
import {
  authHeaderSchema,
  errorEnvelopeSchema,
  resourceDeleteResultSchema,
  resourceKindSchema,
  resourceListQuerySchema,
  resourceMutationSchema,
  resourceRecordSchema,
  successEnvelopeSchema,
} from './schemas.js';

export const contractRoutesResources = {
  resourcesCreate: {
    method: 'POST',
    path: '/api/v1/resources/:kind',
    headers: authHeaderSchema,
    pathParams: z.object({
      kind: resourceKindSchema,
    }),
    body: resourceMutationSchema,
    responses: {
      201: successEnvelopeSchema(resourceRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Create resource entity',
  },
  resourcesDelete: {
    method: 'DELETE',
    path: '/api/v1/resources/:kind/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      kind: resourceKindSchema,
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(resourceDeleteResultSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Delete resource entity',
  },
  resourcesGet: {
    method: 'GET',
    path: '/api/v1/resources/:kind/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      kind: resourceKindSchema,
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(resourceRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Get resource entity by id',
  },
  resourcesList: {
    method: 'GET',
    path: '/api/v1/resources/:kind',
    headers: authHeaderSchema,
    pathParams: z.object({
      kind: resourceKindSchema,
    }),
    query: resourceListQuerySchema,
    responses: {
      200: successEnvelopeSchema(z.array(resourceRecordSchema)),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'List resource entities',
  },
  resourcesUpdate: {
    method: 'PATCH',
    path: '/api/v1/resources/:kind/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      kind: resourceKindSchema,
      id: z.string().min(1),
    }),
    body: resourceMutationSchema,
    responses: {
      200: successEnvelopeSchema(resourceRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Update resource entity',
  },
  resourcesUpsert: {
    method: 'PATCH',
    path: '/api/v1/resources/:kind/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      kind: resourceKindSchema,
      id: z.string().min(1),
    }),
    body: resourceMutationSchema,
    responses: {
      200: successEnvelopeSchema(resourceRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Deprecated alias for update resource entity',
  },
} as const;
