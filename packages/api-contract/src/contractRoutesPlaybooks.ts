import { z } from 'zod';
import {
  authHeaderSchema,
  errorEnvelopeSchema,
  playbookCreateSchema,
  playbookDeleteResultSchema,
  playbookRecordSchema,
  playbookUpdateSchema,
  playbookValidateBodySchema,
  playbookValidationResultSchema,
  successEnvelopeSchema,
} from './schemas.js';

export const contractRoutesPlaybooks = {
  playbooksCreate: {
    method: 'POST',
    path: '/api/v1/playbooks',
    headers: authHeaderSchema,
    body: playbookCreateSchema,
    responses: {
      201: successEnvelopeSchema(playbookRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      422: errorEnvelopeSchema,
    },
    summary: 'Create playbook',
  },
  playbooksDelete: {
    method: 'DELETE',
    path: '/api/v1/playbooks/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(playbookDeleteResultSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Delete playbook',
  },
  playbooksGet: {
    method: 'GET',
    path: '/api/v1/playbooks/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(playbookRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Get playbook by id',
  },
  playbooksList: {
    method: 'GET',
    path: '/api/v1/playbooks',
    headers: authHeaderSchema,
    responses: {
      200: successEnvelopeSchema(z.array(playbookRecordSchema)),
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'List playbooks',
  },
  playbooksUpdate: {
    method: 'PUT',
    path: '/api/v1/playbooks/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    body: playbookUpdateSchema,
    responses: {
      200: successEnvelopeSchema(playbookRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
      422: errorEnvelopeSchema,
    },
    summary: 'Update playbook',
  },
  playbooksValidate: {
    method: 'POST',
    path: '/api/v1/playbooks/validate',
    headers: authHeaderSchema,
    body: playbookValidateBodySchema,
    responses: {
      200: successEnvelopeSchema(playbookValidationResultSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Validate playbook content',
  },
} as const;
