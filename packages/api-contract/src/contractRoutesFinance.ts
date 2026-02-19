import { z } from 'zod';
import {
  authHeaderSchema,
  errorEnvelopeSchema,
  financeDailyStatsSchema,
  financeDeleteResultSchema,
  financeGoldPriceHistorySchema,
  financeListQuerySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  financeOperationRecordSchema,
  successEnvelopeSchema,
} from './schemas.js';

export const contractRoutesFinance = {
  financeDailyStats: {
    method: 'GET',
    path: '/api/v1/finance/daily-stats',
    headers: authHeaderSchema,
    responses: {
      200: successEnvelopeSchema(financeDailyStatsSchema),
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Get finance daily stats',
  },
  financeGoldPriceHistory: {
    method: 'GET',
    path: '/api/v1/finance/gold-price-history',
    headers: authHeaderSchema,
    responses: {
      200: successEnvelopeSchema(financeGoldPriceHistorySchema),
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Get finance gold price history',
  },
  financeOperationsCreate: {
    method: 'POST',
    path: '/api/v1/finance/operations',
    headers: authHeaderSchema,
    body: financeOperationCreateSchema,
    responses: {
      201: successEnvelopeSchema(financeOperationRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Create finance operation',
  },
  financeOperationsDelete: {
    method: 'DELETE',
    path: '/api/v1/finance/operations/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(financeDeleteResultSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Delete finance operation',
  },
  financeOperationsGet: {
    method: 'GET',
    path: '/api/v1/finance/operations/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    responses: {
      200: successEnvelopeSchema(financeOperationRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Get finance operation by id',
  },
  financeOperationsList: {
    method: 'GET',
    path: '/api/v1/finance/operations',
    headers: authHeaderSchema,
    query: financeListQuerySchema,
    responses: {
      200: successEnvelopeSchema(z.array(financeOperationRecordSchema)),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'List finance operations',
  },
  financeOperationsPatch: {
    method: 'PATCH',
    path: '/api/v1/finance/operations/:id',
    headers: authHeaderSchema,
    pathParams: z.object({
      id: z.string().min(1),
    }),
    body: financeOperationPatchSchema,
    responses: {
      200: successEnvelopeSchema(financeOperationRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
    },
    summary: 'Patch finance operation',
  },
} as const;
